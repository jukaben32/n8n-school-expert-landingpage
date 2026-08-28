'use client'

import { useState } from 'react'
import { Building2, Settings2, CreditCard, Download } from 'lucide-react'
import SchoolProfileForm from './SchoolProfileForm'
import OperationsForm from './OperationsForm'
import AzulSettingsForm from './AzulSettingsForm'
import ExportDataButton from './ExportDataButton'
import type { PaymentSettingsDisplay } from './paymentSettingsActions'

interface School {
  id: string
  name: string
  tagline: string | null
  subdomain: string
  address: string | null
  phone: string | null
  email: string | null
  sibling_discount_min_children: number
  sibling_discount_percent: number
  faq_document: string | null
  tuition_parvulo_amount: number | null
  tuition_inicial_amount: number | null
  tuition_primaria_amount: number | null
  tuition_secundaria_amount: number | null
  tuition_installments_count: number
  tuition_due_day: number
  tuition_grace_days: number
  late_fee_percent: number
}

const TABS = [
  { id: 'profile', label: 'Perfil del colegio', icon: Building2 },
  { id: 'operations', label: 'Operación', icon: Settings2 },
  { id: 'payments', label: 'Pagos', icon: CreditCard },
  { id: 'data', label: 'Datos', icon: Download },
] as const

type TabId = (typeof TABS)[number]['id']

export default function ConfigTabs({
  school,
  paymentSettings,
}: {
  school: School
  paymentSettings: PaymentSettingsDisplay | null
}) {
  const [tab, setTab] = useState<TabId>('profile')

  return (
    <div>
      <div className="flex items-center gap-1 p-1 mb-5 rounded-full bg-slate-100 dark:bg-slate-800 w-fit overflow-x-auto max-w-full">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition ${
              tab === t.id
                ? 'bg-primary text-white shadow'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && <SchoolProfileForm school={school} />}
      {tab === 'operations' && <OperationsForm school={school} />}
      {tab === 'payments' && paymentSettings && <AzulSettingsForm initial={paymentSettings} />}
      {tab === 'data' && <ExportDataButton schoolSubdomain={school.subdomain} />}
    </div>
  )
}
