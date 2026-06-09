import { useState } from 'react'
import InspirationTab from '../components/content/InspirationTab'
import AIAnalysisTab from '../components/content/AIAnalysisTab'
import IdeaDumpTab from '../components/content/IdeaDumpTab'
import BatchesTab from '../components/content/BatchesTab'
import ProductionPipelineTab from '../components/content/ProductionPipelineTab'

const TABS = ['Inspiration', 'AI Analysis', 'Idea Dump', 'Batches', 'Production Pipeline']

function ContentDecoration() {
  return (
    <svg width="110" height="70" viewBox="0 0 110 70" fill="none">
      <circle cx="60" cy="35" r="28" stroke="currentColor" strokeWidth="1.5" opacity="0.2"/>
      <circle cx="60" cy="35" r="16" fill="currentColor" opacity="0.07"/>
      <rect x="10" y="22" width="30" height="3" rx="1.5" fill="currentColor" opacity="0.25"/>
      <rect x="10" y="33" width="24" height="3" rx="1.5" fill="currentColor" opacity="0.18"/>
      <rect x="10" y="44" width="28" height="3" rx="1.5" fill="currentColor" opacity="0.18"/>
    </svg>
  )
}

export default function ContentPage() {
  const [tab, setTab] = useState('Inspiration')
  const [ideaDumpRefresh, setIdeaDumpRefresh] = useState(0)

  return (
    <div>
      <div className="page-header header-creative mb-6" style={{ '--section-tab-color': 'var(--creative)' }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1>Content Hub</h1>
            <p>From inspiration to posted</p>
          </div>
        </div>
        <div className="page-header-decoration" style={{ color: 'var(--creative)' }}><ContentDecoration /></div>
      </div>

      <div className="tab-bar" style={{ '--section-tab-color': 'var(--creative)' }}>
        {TABS.map(t => (
          <button key={t} className={`tab-item ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Inspiration'          && <InspirationTab />}
      {tab === 'AI Analysis'          && <AIAnalysisTab onSaveIdea={() => setIdeaDumpRefresh(v => v+1)} />}
      {tab === 'Idea Dump'            && <IdeaDumpTab refreshKey={ideaDumpRefresh} />}
      {tab === 'Batches'              && <BatchesTab />}
      {tab === 'Production Pipeline'  && <ProductionPipelineTab />}
    </div>
  )
}
