import { useState } from 'react'
import InspirationTab from '../components/content/InspirationTab'
import AIAnalysisTab from '../components/content/AIAnalysisTab'
import IdeaDumpTab from '../components/content/IdeaDumpTab'
import BatchesTab from '../components/content/BatchesTab'
import ProductionPipelineTab from '../components/content/ProductionPipelineTab'

const TABS = ['Inspiration', 'AI Analysis', 'Idea Dump', 'Batches', 'Production Pipeline']

export default function ContentPage() {
  const [tab, setTab] = useState('Inspiration')
  const [ideaDumpRefresh, setIdeaDumpRefresh] = useState(0)

  function handleSaveIdea() {
    // Bump refresh key so IdeaDump reloads when AI Analysis saves an idea
    if (tab === 'AI Analysis') setIdeaDumpRefresh(v => v + 1)
  }

  return (
    <div>
      <div className="page-header">
        <h1>Content Hub</h1>
        <p>Your content pipeline from inspiration to posted</p>
      </div>

      <div className="tab-bar">
        {TABS.map(t => (
          <button key={t} className={`tab-item ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Inspiration' && <InspirationTab />}
      {tab === 'AI Analysis' && <AIAnalysisTab onSaveIdea={handleSaveIdea} />}
      {tab === 'Idea Dump' && <IdeaDumpTab refreshKey={ideaDumpRefresh} />}
      {tab === 'Batches' && <BatchesTab />}
      {tab === 'Production Pipeline' && <ProductionPipelineTab />}
    </div>
  )
}
