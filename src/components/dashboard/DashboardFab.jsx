import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, ListTodo, Receipt } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { format, startOfWeek } from 'date-fns'
import QuickAddExpense from '../finance/QuickAddExpense'
import { TASK_AREAS } from '../../lib/constants'

export default function DashboardFab({ onAddExpense }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('task') // 'task' | 'expense'
  const [task, setTask] = useState('')
  const [area, setArea] = useState('Career')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  async function addTask() {
    if (!task.trim() || saving) return
    setSaving(true)
    const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
    await supabase.from('weekly_tasks').insert({
      user_id: user.id, week_start: weekStart,
      area, specific_task: task.trim(), action: '',
      frequency: 'One-off', complete: false, carried_forward: false,
    })
    setTask('')
    setSaving(false)
    setDone(true)
    setTimeout(() => setDone(false), 1800)
  }

  function handleExpenseAdd(expense) {
    onAddExpense?.(expense)
    setDone(true)
    setTimeout(() => { setDone(false); setOpen(false) }, 1400)
  }

  return (
    <>
      {/* FAB — mobile only */}
      <div className="dashboard-fab" style={{ position: 'fixed', bottom: 24, right: 20, zIndex: 90 }}>
        <button
          className="btn btn-career"
          onClick={() => { setOpen(v => !v); setDone(false) }}
          style={{
            width: 52, height: 52, borderRadius: '50%', padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)', color: '#fff',
          }}
        >
          {open ? <X size={20} /> : <Plus size={22} />}
        </button>
      </div>

      {/* Bottom sheet */}
      {open && createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 91 }}
            onClick={() => setOpen(false)}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 92,
            background: 'var(--card-bg)', borderRadius: '20px 20px 0 0',
            padding: '20px 20px 36px',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
            animation: 'slideUp 0.2s ease',
          }}>
            {/* Pill handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 16px' }} />

            {/* Tab switcher */}
            <div className="flex items-center gap-2 mb-4">
              <button
                className={`btn btn-sm ${tab === 'task' ? 'btn-career' : 'btn-ghost'}`}
                style={tab === 'task' ? { color: '#fff' } : {}}
                onClick={() => setTab('task')}
              >
                <ListTodo size={13} /> Weekly task
              </button>
              <button
                className={`btn btn-sm ${tab === 'expense' ? 'btn-finance' : 'btn-ghost'}`}
                style={tab === 'expense' ? { color: '#fff' } : {}}
                onClick={() => setTab('expense')}
              >
                <Receipt size={13} /> Expense
              </button>
            </div>

            {tab === 'task' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <select value={area} onChange={e => setArea(e.target.value)} style={{ fontSize: 13 }}>
                  {TASK_AREAS.map(a => <option key={a}>{a}</option>)}
                </select>
                <div className="flex gap-2">
                  <input
                    value={task}
                    onChange={e => setTask(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addTask()}
                    placeholder="What needs doing this week?"
                    style={{ fontSize: 13, flex: 1 }}
                    autoFocus
                  />
                  <button
                    className={`btn btn-career btn-sm ${done ? 'btn-ghost' : ''}`}
                    style={!done ? { color: '#fff' } : { color: 'var(--success)' }}
                    onClick={addTask}
                    disabled={saving || !task.trim()}
                  >
                    {done ? '✓' : saving ? '…' : 'Add'}
                  </button>
                </div>
              </div>
            ) : (
              <QuickAddExpense onAdd={handleExpenseAdd} compact />
            )}
          </div>
        </>,
        document.body
      )}
    </>
  )
}
