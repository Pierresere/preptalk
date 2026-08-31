import { useT } from '../i18n'
import type { Dossier } from '../types.js'

interface DossierListProps {
  dossiers: Dossier[]
  onOpen: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
}

export function DossierList({ dossiers, onOpen, onDelete, onNew }: DossierListProps) {
  const t = useT()

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (window.confirm(t('dossiers.confirmDelete'))) {
      onDelete(id)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--gap)' }}>
        <button type="button" className="btn btn-primary" onClick={onNew}>
          {t('dossiers.new')}
        </button>
      </div>

      {dossiers.length === 0 ? (
        <p>{t('dossiers.empty')}</p>
      ) : (
        <div className="dossier-grid">
          {dossiers.map((d) => (
            <div key={d.id} className="panel dossier-card" onClick={() => onOpen(d.id)}>
              <strong>{d.company}</strong>
              <p>{d.position}</p>
              <p className="dossier-date">{new Date(d.updatedAt).toLocaleDateString()}</p>
              <button type="button" className="btn" onClick={(e) => handleDelete(e, d.id)}>
                {t('dossiers.delete')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
