import { FORGOT_FIELDS, FORGOT_TEMPLATE } from '../../lib/content'
import { IG_DM_URL, IG_HANDLE } from '../../lib/config'
import { BackLink, Btn, Card, CopyButton, Shell } from '../../components/ui'

export default function ForgotCode() {
  return (
    <Shell>
      <div className="space-y-4">
        <BackLink to="/">Back</BackLink>
        <h1 className="font-display text-3xl font-semibold">Forgot your booking code?</h1>
        <p className="text-sm text-cream/80">No worries. Message {IG_HANDLE} on Instagram and she will help you find it. To keep your booking safe, please include:</p>
        <Card>
          <ul className="list-disc space-y-1.5 pl-5 text-sm">{FORGOT_FIELDS.map((f) => <li key={f}>{f}</li>)}</ul>
        </Card>
        <Card className="space-y-3">
          <pre className="whitespace-pre-wrap font-body text-sm text-cream/80">{FORGOT_TEMPLATE}</pre>
          <CopyButton text={FORGOT_TEMPLATE} label="Copy message" className="w-full" />
        </Card>
        <Btn as="a" href={IG_DM_URL} target="_blank" rel="noreferrer" variant="primary" className="w-full">Open Instagram to message</Btn>
        <p className="text-xs text-cream/60">For your privacy, booking codes are only shared once the details above match your booking.</p>
      </div>
    </Shell>
  )
}
