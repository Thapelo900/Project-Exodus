import './shared/messages'
import './shared/schemas'
import { isServer } from '@dcl/sdk/network'

export function main() {
  if (isServer()) {
    void import('./server/setup').then(({ setupServer }) => setupServer())
  } else {
    void import('./client/setup').then(({ setupClient }) => setupClient())
  }
}
