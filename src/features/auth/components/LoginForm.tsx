"use client";

import { useActionState } from "react";

import { FormError, SubmitButton, TextField } from "@/components/ui/form";
import { format, type Messages } from "@/lib/i18n";

import { loginAction, type LoginState } from "../actions";
import { displayPhone } from "../phone";

const initialState: LoginState = { step: "phone" };

/** Registration and login are the same flow: phone number, then the SMS code. */
export function LoginForm({ t }: { t: Messages }) {
  const [state, action] = useActionState(loginAction, initialState);
  const phone = state.phone;

  if (state.step === "otp" && phone) {
    return (
      <form action={action} className="flex flex-col gap-6" key="otp">
        <input type="hidden" name="intent" value="verify" />
        <p className="text-lg text-stone-800">{format(t.login.codeSent, { phone: displayPhone(phone) })}</p>
        <input type="hidden" name="phone" value={phone} />
        <TextField
          name="code"
          label={t.login.codeLabel}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          required
          error={state.fieldErrors?.code && t.errors[state.fieldErrors.code]}
        />
        <FormError message={state.formError && t.errors[state.formError]} />
        <SubmitButton label={t.login.verify} pendingLabel={t.login.verifying} />
        <a
          href="/login"
          className="flex min-h-12 items-center justify-center text-lg font-medium text-green-800 underline underline-offset-4"
        >
          {t.login.changeNumber}
        </a>
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6" key="phone">
      <input type="hidden" name="intent" value="send" />
      <TextField
        name="phone"
        label={t.login.phoneLabel}
        hint={t.login.phoneHint}
        inputMode="tel"
        autoComplete="tel-national"
        maxLength={16}
        required
        defaultValue={state.values?.phone}
        error={state.fieldErrors?.phone && t.errors[state.fieldErrors.phone]}
      />
      <FormError message={state.formError && t.errors[state.formError]} />
      <SubmitButton label={t.login.sendCode} pendingLabel={t.login.sendingCode} />
    </form>
  );
}
