import { useState } from 'react'
import {
  DndContext, closestCenter,
  KeyboardSensor, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, X, GripVertical } from 'lucide-react'

// Single sortable, editable, deletable subtask row.
function SubtaskRow({ subtask, accentColor, onToggle, onEditText, onDelete }) {
  const [editing,  setEditing]  = useState(false)
  const [textInput, setTextInput] = useState(subtask.text)

  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: subtask.id })

  function saveText() {
    const t = textInput.trim()
    if (t && t !== subtask.text) onEditText(t)
    else setTextInput(subtask.text)
    setEditing(false)
  }

  return (
    <div
      ref={setNodeRef}
      className="subtask-row"
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        title="Drag to reorder"
        style={{ color: 'var(--border)', cursor: 'grab', flexShrink: 0, display: 'flex', touchAction: 'none' }}
      >
        <GripVertical size={11} />
      </div>

      {/* Toggle dot */}
      <div className={`toggle-dot ${subtask.complete ? 'done' : ''}`} onClick={onToggle}
        style={{ width: 16, height: 16, borderColor: accentColor, flexShrink: 0, cursor: 'pointer' }}>
        {subtask.complete && <Check size={8} color="white" strokeWidth={3} />}
      </div>

      {/* Text — click to edit inline */}
      {editing ? (
        <input
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          onBlur={saveText}
          onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { setTextInput(subtask.text); setEditing(false) } }}
          autoFocus
          style={{ flex: 1, fontSize: 12, minWidth: 0, padding: '1px 5px' }}
        />
      ) : (
        <span
          onClick={() => { setTextInput(subtask.text); setEditing(true) }}
          title="Click to edit"
          style={{
            flex: 1,
            fontSize: 12,
            color: subtask.complete ? 'var(--text-3)' : 'var(--text-2)',
            textDecoration: subtask.complete ? 'line-through' : 'none',
            cursor: 'text',
            minWidth: 0,
            wordBreak: 'break-word',
          }}>
          {subtask.text}
        </span>
      )}

      {/* Delete — shown on hover (desktop) / always reachable via tap (mobile) */}
      <button
        className="btn-icon subtask-delete"
        onClick={onDelete}
        title="Delete subtask"
        style={{ padding: 2, flexShrink: 0, color: 'var(--text-3)' }}
      >
        <X size={11} />
      </button>
    </div>
  )
}

// Reusable subtask list — sortable (drag to reorder), each row editable/deletable.
// subtasks: [{ id, text, complete }]. Calls onReorder with the full reordered array.
export default function SubtaskList({ subtasks, accentColor = 'var(--career)', onToggle, onEditText, onDelete, onReorder }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const ids = subtasks.map(s => s.id)

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const oldIdx = ids.indexOf(active.id)
    const newIdx = ids.indexOf(over.id)
    if (oldIdx !== -1 && newIdx !== -1) onReorder(arrayMove(subtasks, oldIdx, newIdx))
  }

  if (!subtasks.length) return null

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {subtasks.map(s => (
            <SubtaskRow
              key={s.id}
              subtask={s}
              accentColor={accentColor}
              onToggle={() => onToggle(s.id)}
              onEditText={text => onEditText(s.id, text)}
              onDelete={() => onDelete(s.id)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
