import { POLICY_INTRO } from '../../lib/content'
import { BackLink, Shell } from '../../components/ui'
import { PolicySections } from '../../components/PolicyGate'

export default function Policies() {
  return (
    <Shell>
      <div className="space-y-4">
        <BackLink to="/">Back</BackLink>
        <h1 className="font-display text-3xl font-semibold">Policies</h1>
        <p className="text-sm text-cream/80">{POLICY_INTRO}</p>
        <PolicySections />
      </div>
    </Shell>
  )
}
