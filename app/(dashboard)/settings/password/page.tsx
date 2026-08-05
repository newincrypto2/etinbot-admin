import { redirect } from 'next/navigation'

// Przeniesione na kartę konta (klik w awatar w nagłówku).
export default function PasswordSettingsPage() {
  redirect('/konto')
}
