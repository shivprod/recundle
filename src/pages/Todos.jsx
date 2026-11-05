import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Badge, Button, Card, Dialog, Empty, Field, Icon, Input, PageHeader, Segmented, Select, Textarea } from '@/components/ui';
import { shortDate } from '@/core/format';
import { useApp } from '@/data/AppData';
import { cn } from '@/lib/cn';

export const TODO_CATEGORIES = [
  { id: 'family', label: 'Family', icon: 'Users', hue: 'from-[#e8f4f3] to-[#d5ecea] dark:from-[#1f3a39] dark:to-[#173030]' },
  { id: 'health', label: 'Healthcare', icon: 'HeartPulse', hue: 'from-[#fdecef] to-[#f9dbe2] dark:from-[#3b2228] dark:to-[#301c21]' },
  { id: 'documents', label: 'Personal documentation', icon: 'IdCard', hue: 'from-[#eaf0fb] to-[#dce6f8] dark:from-[#1e2a3b] dark:to-[#192334]' },
  { id: 'finance', label: 'Finance', icon: 'Wallet', hue: 'from-[#eef6e6] to-[#e0efd2] dark:from-[#25311d] dark:to-[#1f2a18]' },
  { id: 'home', label: 'Home', icon: 'House', hue: 'from-[#fbf2e3] to-[#f6e6c8] dark:from-[#3a3020] dark:to-[#30281a]' },
  { id: 'admin', label: 'Administrative', icon: 'ClipboardList', hue: 'from-[#f1edfb] to-[#e4dcf7] dark:from-[#2b2540] dark:to-[#241f36]' },
  { id: 'other', label: 'Other', icon: 'Sparkles', hue: 'from-[#f1f3f2] to-[#e5e9e7] dark:from-[#2d3130] dark:to-[#262a29]' },
];
const CAT = Object.fromEntries(TODO_CATEGORIES.map((c) => [c.id, c]));

/**
 * One responsibility as a card. Front: what it is. Click to flip; back: status and actions.
 * Keyboard: Enter/Space flips; the back's buttons are reachable with Tab.
 */
function Flashcard({ todo, onEdit, onDelete, index }) {
  const { actions } = useApp();
  const [flipped, setFlipped] = useState(false);
  const cat = CAT[todo.category] ?? CAT.other;
  const done = todo.status === 'completed';
  const flip = () => setFlipped((f) => !f);
  return (
    <motion.li layout initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.3, delay: Math.min(index, 8) * 0.03 }} className="flip-scene h-[210px] list-none">
      <div className={cn('flip-inner relative h-full w-full', flipped && 'is-flipped')}>
        {/* Front */}
        <div
          role="button"
          tabIndex={flipped ? -1 : 0}
          aria-label={`${todo.title}. ${done ? 'Completed' : 'Pending'}. Flip for actions.`}
          onClick={flip}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), flip())}
          className={cn('flip-face absolute inset-0 flex cursor-pointer flex-col rounded-2xl border border-line bg-gradient-to-br p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md', cat.hue, done && 'opacity-70')}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/70 px-2.5 py-1 text-[12px] font-medium text-ink-2">
              <Icon name={cat.icon} size={13} /> {cat.label}
            </span>
            {done ? <Badge tone="good" icon="Check">Done</Badge> : <Badge tone="warn" icon="Clock">Pending</Badge>}
          </div>
          <p className={cn('mt-3 line-clamp-2 text-[18px] font-semibold leading-snug tracking-tight', done && 'line-through decoration-2')}>{todo.title}</p>
          {todo.description && <p className="mt-1 line-clamp-2 text-[13.5px] text-ink-2">{todo.description}</p>}
          <div className="mt-auto flex items-center justify-between text-[12px] text-ink-3">
            <span>{todo.dueDate ? `By ${shortDate(todo.dueDate)}` : todo.notes ? 'Has notes' : ''}</span>
            <span className="inline-flex items-center gap-1"><Icon name="RotateCw" size={12} /> Tap to flip</span>
          </div>
        </div>
        {/* Back */}
        <div className="flip-face flip-back absolute inset-0 flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-md" aria-hidden={!flipped}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[12px] text-ink-3">Status</p>
              <p className={cn('text-[15px] font-semibold', done ? 'text-good' : 'text-warn')}>{done ? `Completed${todo.completedAt ? ` · ${shortDate(todo.completedAt.slice(0, 10))}` : ''}` : 'Pending'}</p>
            </div>
            <button type="button" tabIndex={flipped ? 0 : -1} onClick={flip} className="rounded-lg p-1.5 text-ink-3 hover:bg-surface-2" aria-label="Flip back">
              <Icon name="Undo2" size={17} />
            </button>
          </div>
          {todo.notes && <p className="mt-2 line-clamp-2 text-[12.5px] text-ink-2">{todo.notes}</p>}
          <div className="mt-auto grid grid-cols-2 gap-2">
            {done ? (
              <Button tabIndex={flipped ? 0 : -1} variant="secondary" size="sm" icon="RotateCcw" onClick={() => { actions.setTodoStatus(todo.id, 'pending'); setFlipped(false); toast('Moved back to pending'); }}>Reopen</Button>
            ) : (
              <Button tabIndex={flipped ? 0 : -1} size="sm" icon="Check" onClick={() => { actions.setTodoStatus(todo.id, 'completed'); setFlipped(false); toast.success('Nice. Marked as done.'); }}>Mark completed</Button>
            )}
            {done ? (
              <Button tabIndex={flipped ? 0 : -1} variant="outline" size="sm" icon="Pencil" onClick={() => onEdit(todo)}>Edit</Button>
            ) : (
              <Button tabIndex={flipped ? 0 : -1} variant="outline" size="sm" icon="Clock" onClick={() => setFlipped(false)}>Keep pending</Button>
            )}
            {!done && <Button tabIndex={flipped ? 0 : -1} variant="ghost" size="sm" icon="Pencil" onClick={() => onEdit(todo)}>Edit</Button>}
            <Button tabIndex={flipped ? 0 : -1} variant="danger-ghost" size="sm" icon="Trash2" onClick={() => onDelete(todo)} className={done ? 'col-span-2' : ''}>Delete</Button>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

export function TodoEditor({ todo, open, onClose }) {
  const { actions } = useApp();
  const [f, setF] = useState(null);
  if (open && !f) setF({ title: todo?.title ?? '', description: todo?.description ?? '', category: todo?.category ?? 'other', notes: todo?.notes ?? '', dueDate: todo?.dueDate ?? '' });
  if (!open && f) setF(null);
  if (!f) return null;
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = () => {
    if (!f.title.trim()) return;
    actions.saveTodo({ ...(todo?.id ? { id: todo.id } : {}), title: f.title.trim(), description: f.description.trim(), category: f.category, notes: f.notes.trim(), dueDate: f.dueDate || null });
    toast.success(todo?.id ? 'Updated' : 'Added');
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title={todo?.id ? 'Edit to-do' : 'New to-do'} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={!f.title.trim()}>{todo?.id ? 'Save' : 'Add'}</Button></>}>
      <div className="grid gap-3">
        <Field label="What needs doing?"><Input autoFocus value={f.title} onChange={set('title')} placeholder="e.g. Renew my passport" onKeyDown={(e) => e.key === 'Enter' && save()} /></Field>
        <Field label="Short description (optional)"><Input value={f.description} onChange={set('description')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category"><Select value={f.category} onChange={set('category')}>{TODO_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</Select></Field>
          <Field label="By (optional)"><Input type="date" value={f.dueDate} onChange={set('dueDate')} /></Field>
        </div>
        <Field label="Notes (optional)"><Textarea value={f.notes} onChange={set('notes')} rows={2} /></Field>
      </div>
    </Dialog>
  );
}

export default function Todos() {
  const { todos, actions } = useApp();
  const [view, setView] = useState('pending');
  const [cat, setCat] = useState('all');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const pending = todos.filter((t) => t.status !== 'completed');
  const completed = todos.filter((t) => t.status === 'completed');
  const list = (view === 'pending' ? pending : completed)
    .filter((t) => cat === 'all' || t.category === cat)
    .sort((a, b) => (view === 'pending' ? (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || (b.createdAt ?? '').localeCompare(a.createdAt ?? '') : (b.completedAt ?? '').localeCompare(a.completedAt ?? '')));
  const usedCats = TODO_CATEGORIES.filter((c) => todos.some((t) => t.category === c.id));

  return (
    <div>
      <PageHeader title="To-Dos" subtitle="The things still waiting on you. Tap a card to flip it." actions={<Button icon="Plus" onClick={() => setEditing({})}>New to-do</Button>} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented id="todo-view" label="Show" value={view} onChange={setView} options={[{ value: 'pending', label: 'Pending', count: pending.length, icon: 'Clock' }, { value: 'completed', label: 'Completed', count: completed.length, icon: 'CircleCheck' }]} />
        {usedCats.length > 1 && (
          <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
            {[{ id: 'all', label: 'All' }, ...usedCats].map((c) => (
              <button key={c.id} type="button" onClick={() => setCat(c.id)} aria-pressed={cat === c.id} className={cn('shrink-0 rounded-full px-3 py-1.5 text-[12.5px] font-medium', cat === c.id ? 'bg-primary text-primary-ink' : 'bg-surface-2 text-ink-2 hover:text-ink')}>
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {list.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {list.map((t, i) => (
              <Flashcard key={t.id} todo={t} index={i} onEdit={setEditing} onDelete={setDeleting} />
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <Card>
          <Empty icon={view === 'pending' ? 'PartyPopper' : 'ListTodo'} title={view === 'pending' ? (todos.length ? 'Nothing pending. Well done.' : 'What’s still on your plate?') : 'Nothing completed yet'} action={view === 'pending' && <Button icon="Plus" onClick={() => setEditing({})}>Add a to-do</Button>}>
            {view === 'pending' && !todos.length && 'Renew a passport, book a check-up, file a claim: add the responsibilities you don’t want to forget. No due dates needed.'}
          </Empty>
        </Card>
      )}
      <TodoEditor todo={editing} open={Boolean(editing)} onClose={() => setEditing(null)} />
      <Dialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this to-do?"
        footer={<><Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" onClick={() => { actions.deleteTodo(deleting.id); setDeleting(null); toast.success('Deleted'); }}>Delete</Button></>}
      >
        “{deleting?.title}” will be removed. To keep it for the record, mark it completed instead.
      </Dialog>
    </div>
  );
}
