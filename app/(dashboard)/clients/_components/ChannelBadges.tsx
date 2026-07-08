import { MessageCircle, Mail, MessageSquare, Phone, Mic, ShoppingBag, Store, Package } from 'lucide-react'
import type { ClientChannels } from '@/queries/clients'

const CHANNEL_DEFS: { key: keyof ClientChannels; label: string; Icon: React.ElementType }[] = [
  { key: 'webchat', label: 'Webchat', Icon: MessageCircle },
  { key: 'email', label: 'E-mail', Icon: Mail },
  { key: 'messenger', label: 'Messenger', Icon: MessageSquare },
  { key: 'sms', label: 'SMS', Icon: Phone },
  { key: 'voice', label: 'Voice', Icon: Mic },
  { key: 'allegro', label: 'Allegro', Icon: ShoppingBag },
  { key: 'woocommerce', label: 'WooCommerce', Icon: Store },
  { key: 'baselinker', label: 'BaseLinker', Icon: Package },
]

export function ChannelBadges({ channels }: { channels: ClientChannels }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {CHANNEL_DEFS.map(({ key, label, Icon }) => {
        const on = channels[key]
        return (
          <span
            key={key}
            title={`${label}: ${on ? 'aktywne' : 'nieskonfigurowane'}`}
            className={`inline-flex items-center justify-center h-6 w-6 rounded-md ${on ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-300'}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        )
      })}
    </div>
  )
}
