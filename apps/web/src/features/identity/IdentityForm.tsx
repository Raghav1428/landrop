import { useState, type FormEvent } from "react";
import { identitySchema, type Identity } from "@landrop/protocol";
export function IdentityForm({
  submit,
  busy,
}: {
  submit: (v: Identity) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [device, setDevice] = useState<Identity["device"]>("computer");
  return (
    <form
      className="stack"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        submit(identitySchema.parse({ name, device }));
      }}
    >
      <h2>Your browser identity</h2>
      <p>Choose how you appear to others. No account, no sign-up.</p>
      <label>
        Display name
        <input
          autoComplete="nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          required
        />
      </label>
      <label>
        Device type
        <select
          value={device}
          onChange={(e) => setDevice(e.target.value as Identity["device"])}
        >
          <option value="computer">Computer</option>
          <option value="phone">Phone</option>
          <option value="tablet">Tablet</option>
          <option value="other">Other</option>
        </select>
      </label>
      <button
        className="primary"
        disabled={busy || !identitySchema.safeParse({ name, device }).success}
      >
        {busy ? "Connecting…" : "Continue"}
      </button>
      <small>
        One identity per browser profile. Tabs share the same identity.
      </small>
    </form>
  );
}
