import { POLICY_INTRO } from '../../lib/content'
import { BackLink, Shell } from '../../components/ui'
import { PolicySections } from '../../components/PolicyGate'
import { Skeleton } from '../../components/Feedback'
import { policiesFrom, usePublicSettings } from '../../lib/publicSettings'

export default function Policies() {
  const cfg = usePublicSettings()
  return (
    <Shell>
      <div className="space-y-4">
        <BackLink to="/">Back</BackLink>
        <h1 className="font-display text-3xl font-semibold">Policies</h1>
        <p className="text-sm text-cream/80">{POLICY_INTRO}</p>
        {cfg ? <PolicySections policies={policiesFrom(cfg)} /> : <Skeleton lines={4} />}
      </div>
    </Shell>
  )
}
