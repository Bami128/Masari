import { useLock } from './LockProvider'
import { LockScreen } from './LockScreen'

export function LockGate() {
  const { locked } = useLock()
  return locked ? <LockScreen /> : null
}
