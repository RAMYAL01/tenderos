# TenderOS — Clerk email templates

The verification-code (OTP) email a user receives at sign-up is **sent by Clerk**,
not by our app. It is customized in the Clerk Dashboard, not in this codebase.

## How to apply the premium template

1. Clerk Dashboard → **Customization → Emails**.
2. Open the **“Verification code”** template.
3. **Subject** — use one of:
   - `{{otp_code}} is your TenderOS verification code`  *(recommended — code visible in inbox preview)*
   - `Verify your email for TenderOS`
4. **From name**: `TenderOS`  ·  **Reply-to** (if available): `support@thetenderos.com`
5. **Body** — switch the editor to **HTML / code view** and paste the contents of
   [`clerk-verification-code.html`](./clerk-verification-code.html).
6. Use Clerk’s **“Send test email”** to preview, then **Save**.

## Clerk variables (do not rename)

| Variable | Becomes |
|---|---|
| `{{otp_code}}` | the 6-digit code |
| `{{app.name}}` | your app name (set under Clerk → Customization) |

> Keep `{{otp_code}}` exactly as-is — Clerk substitutes the real code at send time.
> Hard-coding a number will send everyone the same (wrong) code.

## Using an image logo instead of the text wordmark

The template renders **“TenderOS”** as styled text (most reliable in email clients).
To use a hosted PNG instead, replace the wordmark `<td>` in the header with:

```html
<td>
  <img src="https://www.thetenderos.com/logo-email.png" alt="TenderOS"
       width="132" height="28" style="display:block;border:0;" />
</td>
```

Use a **PNG/JPG** (SVG is blocked by Gmail/Outlook) hosted at a public URL, ideally
~2× resolution for retina. Don’t reference `/icon.svg`.

## Plan note

Editing email templates (custom HTML / removing Clerk branding) may require a
**paid Clerk plan**. The dashboard will indicate if the template is locked.

## Other templates worth branding later

Same process, same look: **Magic link**, **Reset password code**, and
**Organization invitation** (used by TenderOS team invites).
