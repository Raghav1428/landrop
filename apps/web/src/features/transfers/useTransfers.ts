import { useEffect, useRef, useState } from "react";
import type { Snapshot, SessionDto, TransferDto } from "@landrop/protocol";
import { request } from "../../api/client";
import { uploadFile, fileSlot } from "../../transfer/controller";
import { attempt } from "../../transfer/retry";
import { hasher } from "../../workers/client";
import type { LocalContent } from "../offers/Composer";
export function useTransfers(
  room: Snapshot | undefined,
  me: SessionDto | undefined,
  refresh: () => void,
) {
  const contents = useRef(new Map<string, LocalContent>());
  const running = useRef(new Map<string, AbortController>());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, bump] = useState(0);
  const remember = (id: string, content: LocalContent) => {
    contents.current.set(id, content);
    bump((n) => n + 1);
  };
  const abort = (id: string) => {
    running.current.get(id)?.abort();
    contents.current.delete(id);
  };
  useEffect(
    () => () => {
      for (const control of running.current.values()) control.abort();
    },
    [],
  );
  useEffect(() => {
    for (const [id] of contents.current)
      if (!room?.transfers.some((t) => t.id === id)) {
        abort(id);
      }
    for (const transfer of room?.transfers ?? []) {
      if (transfer.senderId !== me?.id) continue;
      if (
        ["completed", "rejected", "cancelled", "expired", "failed"].includes(
          transfer.state,
        )
      ) {
        abort(transfer.id);
        continue;
      }
      const content = contents.current.get(transfer.id);
      if (
        !content ||
        running.current.has(transfer.id) ||
        errors[transfer.id] ||
        !["accepted", "transferring"].includes(transfer.state)
      )
        continue;
      const control = new AbortController();
      running.current.set(transfer.id, control);
      const send = async (t: TransferDto) => {
        if (t.kind === "text")
          await attempt(
            () =>
              request(
                "POST",
                `/api/transfers/${t.id}/text`,
                { text: content.text ?? "" },
                { signal: control.signal },
              ),
            control.signal,
          );
        else
          await Promise.all(
            t.files
              .filter((f) => f.state !== "ready")
              .map((f) =>
                fileSlot(async () => {
                  control.signal.throwIfAborted();
                  const file = content.files?.get(f.id);
                  if (!file)
                    throw new Error("Original file no longer available");
                  const worker = hasher(control.signal);
                  try {
                    await uploadFile({
                      transferId: t.id,
                      fileId: f.id,
                      file,
                      signal: control.signal,
                      hash: worker.hash,
                      request,
                      progress: refresh,
                    });
                  } finally {
                    worker.close();
                  }
                }),
              ),
          );
      };
      void send(transfer)
        .catch((e) => {
          if (e.name !== "AbortError")
            setErrors((v) => ({ ...v, [transfer.id]: e.message }));
        })
        .finally(() => {
          running.current.delete(transfer.id);
          refresh();
        });
    }
  }, [room, me, errors, refresh]);
  return {
    remember,
    abort,
    errors,
    hasContent: (id: string) => contents.current.has(id),
    retry: (id: string) =>
      setErrors((v) => {
        const copy = { ...v };
        delete copy[id];
        return copy;
      }),
  };
}
