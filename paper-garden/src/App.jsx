import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Routes, Route, Navigate, NavLink, Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  BookOpen, Brain, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight,
  Download, ExternalLink, FileText, FileUp, Filter, Flower2, Layers3, Leaf, Link2,
  Menu, MoreHorizontal, Network, Plus, Search, Settings2, SlidersHorizontal, Sparkles,
  Tag, Trash2, Upload, X, Heart, ArrowUpRight, Clock3, Edit3, Sun, Moon,
} from 'lucide-react'
import { db, uid, createPaper, deletePaper, exportBackup, importBackup, now, parseTags, plainText, QUESTIONS, savePaperInfo, seedExampleLibrary } from './lib/db.js'
import { Flower, Sprig } from './components/Decor.jsx'
import AddPaperModal from './components/AddPaperModal.jsx'
import Modal from './components/Modal.jsx'
import RichNotes from './components/RichNotes.jsx'
import Recall from './components/Recall.jsx'
import KnowledgeGraph from './components/KnowledgeGraph.jsx'

let initialization = null
const NAV = [
  { to:'/', title:'My library', icon:BookOpen, end:true },
  { to:'/garden', title:'Knowledge garden', icon:Network },
  { to:'/review', title:'Review nook', icon:Brain },
]
const getInitials = title => (title || '?').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()
const statusColors = {'To read':'unread',Reading:'reading',Explored:'explored'}
const formatDate = iso => iso ? new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric'}) : '—'

function Sidebar({ onAdd }) {
  const inputRef = useRef()
  const [notice,setNotice] = useState('')
  async function handleImport(e) {
    const file=e.target.files?.[0]; if (!file) return
    try { await importBackup(file); setNotice('Backup restored successfully.') }
    catch(err){ setNotice(err.message || 'Could not import this backup.') }
    finally {e.target.value=''}
  }
  return <>
    <aside className="sidebar">
      <Link to="/" className="brand flex items-center gap-3"><span className="brand-flower"><Flower size={36} color="#e1b8b7" center="#f4d78c"/></span><span><strong>paper garden</strong><small>a quiet space for ideas</small></span></Link>
      <p className="nav-heading mt-14">YOUR LITTLE CORNER</p>
      <nav className="space-y-1 mt-4">
        {NAV.map(({to,title,icon:Icon,end})=><NavLink key={to} to={to} end={end} className={({isActive})=>`nav-item ${isActive?'nav-active':''}`}><Icon size={19} strokeWidth={1.8}/>{title}</NavLink>)}
      </nav>
      <div className="px-5 mt-9"><button className="btn-primary w-full" onClick={onAdd}><Plus size={18}/> Add a paper</button></div>
      <div className="sidebar-bottom">
        <div className="soft-reminder"><Flower size={28} color="#d6a9ad"/><p>Small thoughts grow into big ideas.</p><Sprig className="corner-sprig"/></div>
        <p className="nav-heading mb-3">YOUR DATA</p>
        <button className="backup-action" onClick={()=>exportBackup().catch(e=>setNotice(e.message))}><Download size={16}/> Download backup</button>
        <button className="backup-action" onClick={()=>inputRef.current?.click()}><Upload size={16}/> Restore backup</button>
        <input type="file" accept=".json,application/json" className="sr-only" ref={inputRef} onChange={handleImport}/>
        {notice && <div className="notice" role="status">{notice} <button onClick={()=>setNotice('')} aria-label="Dismiss"><X size={12}/></button></div>}
        <p className="text-xs muted mt-4 opacity-70">Everything is stored on this device.</p>
      </div>
    </aside>
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {NAV.map(({to,title,icon:Icon,end})=><NavLink key={to} to={to} end={end} className={({isActive})=>`mobile-nav-link ${isActive?'active':''}`}><Icon size={20}/><span>{title.replace('My ','').replace('Knowledge ','').replace(' nook','')}</span></NavLink>)}
      <button className="mobile-nav-link" onClick={onAdd}><Plus size={20}/><span>New paper</span></button>
    </nav>
  </>
}
function PageShell({ children, onAdd, theme, onToggleTheme }) {
  return <div className="app-shell"><Sidebar onAdd={onAdd}/><div className="main-column">
    <header className="topbar"><span className="mobile-brand"><Flower size={27} color="#d6a9ad"/> paper garden</span><div className="topbar-spacer"/>
      <button type="button" className="theme-toggle" onClick={onToggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-pressed={theme === 'dark'}
        title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        <span className="theme-toggle-label">{theme === 'dark' ? 'Light' : 'Dark'}</span>
      </button>
      <span className="topbar-pill"><span className="online-dot"/> Slow learning is still learning</span>
      <span className="topbar-avatar"><Flower2 size={19}/></span>
    </header>
    <main className="main-content">{children}</main>
  </div></div>
}
function StatChip({ value, label, icon:Icon, color }) {
  return <div className="stat-chip"><span className={`stat-icon ${color}`}><Icon size={18}/></span><span><strong>{value}</strong><small>{label}</small></span></div>
}
function PaperCard({ paper }) {
  const firstTag = paper.tags?.[0]
  const palettes=['var(--cover-1)','var(--cover-2)','var(--cover-3)','var(--cover-4)','var(--cover-5)']
  const tint=palettes[(paper.title?.length || 0)%palettes.length]
  return <Link to={`/paper/${paper.id}`} className="paper-card group">
    <div className="paper-card-cover" style={{background:tint}}>
      <div className="abstract-sun"/>
      <span className="cover-lines"><i/><i/><i/></span>
      <span className="cover-flower"><Flower size={48} color="#ffffffa8" center="#fff6d7"/></span>
      <span className="cover-file"><FileText size={16}/> RESEARCH PAPER</span>
      <span className={`status-pill ${statusColors[paper.status]||'unread'}`}>{paper.status}</span>
    </div>
    <div className="paper-card-body">
      <p className="paper-meta">{paper.year || 'Year unknown'} <span>·</span> {paper.venue || paper.authors || 'Research paper'}</p>
      <h3 className="paper-card-title">{paper.title}</h3>
      <p className="card-description">{paper.abstract || 'A place for your notes, questions, and discoveries.'}</p>
      <div className="card-foot"><div className="flex flex-wrap gap-1.5">{(paper.tags||[]).slice(0,2).map(t=><span key={t} className="tag-chip">{t}</span>)}{(paper.tags||[]).length>2&&<span className="tag-chip">+{paper.tags.length-2}</span>}{!firstTag&&<span className="tag-chip">add tags</span>}</div><ArrowUpRight size={18} className="card-arrow"/></div>
    </div>
  </Link>
}
function PaperListRow({ paper }) {
  return <Link to={`/paper/${paper.id}`} className="paper-list-row">
    <span className="list-icon"><FileText size={21}/></span>
    <span className="flex-1 min-w-0"><strong className="block truncate">{paper.title}</strong><span className="text-xs muted">{paper.authors || 'Unknown authors'} {paper.year?`· ${paper.year}`:''}</span></span>
    <span className="hidden md:flex gap-1 flex-wrap max-w-[250px]">{paper.tags?.slice(0,2).map(t=><span key={t} className="tag-chip">{t}</span>)}</span>
    <span className={`status-pill ${statusColors[paper.status]||'unread'}`}>{paper.status}</span><ChevronRight size={18} className="muted shrink-0"/>
  </Link>
}
function LibraryPage({onAdd}) {
  const papers = useLiveQuery(()=>db.papers.toArray(), [])
  const notes = useLiveQuery(()=>db.notes.toArray(), [])
  const edges = useLiveQuery(()=>db.graphEdges.toArray(), [])
  const [query,setQuery]=useState('')
  const [tag,setTag]=useState('All topics')
  const [status,setStatus]=useState('All statuses')
  const [sort,setSort]=useState('Recently updated')
  const [view,setView]=useState('grid')
  const tags = useMemo(()=>[...new Set((papers||[]).flatMap(p=>p.tags||[]))].sort((a,b)=>a.localeCompare(b)),[papers])
  const notesByPaper = useMemo(()=>Object.fromEntries((notes||[]).map(n=>[n.paperId,plainText(n.html)])),[notes])
  const filtered = useMemo(()=>{
    const q=query.toLowerCase().trim()
    const items=(papers||[]).filter(p=>(tag==='All topics'||p.tags?.includes(tag))&&(status==='All statuses'||p.status===status)&&(!q||[p.title,p.authors,p.year,p.venue,p.abstract,p.doi,p.url,...(p.tags||[]),notesByPaper[p.id]].join(' ').toLowerCase().includes(q)))
    items.sort((a,b)=>sort==='Title A–Z'?a.title.localeCompare(b.title):sort==='Year (newest)'?(b.year||0)-(a.year||0):new Date(b.updatedAt)-new Date(a.updatedAt))
    return items
  },[papers,query,tag,status,sort,notesByPaper])
  const explored=(papers||[]).filter(p=>p.status==='Explored').length
  return <div className="space-y-8">
    <section className="hero-banner">
      <div className="hero-copy"><span className="eyebrow"><Sparkles size={15}/> A gentler way to learn</span>
        <h1 className="font-display">A quiet place for <em>curious minds.</em></h1>
        <p>Collect papers, nurture ideas, and make connections one little step at a time.</p>
        <button className="btn-primary mt-5" onClick={onAdd}><Plus size={17}/> Add a paper</button>
      </div>
      <div className="hero-art" aria-hidden="true"><div className="hero-blob"/><Sprig className="hero-sprig"/><Flower className="hero-flower-large" size={89} color="#d8b6bb" center="#f3d89b"/><Flower className="hero-flower-small" size={45} color="#f0d8c5" center="#f7edbf"/><div className="hero-paper"><div/><div/><div/><span>✦</span></div></div>
    </section>
    <div className="stats-row"><StatChip icon={BookOpen} color="sand" value={papers?.length ?? '—'} label="papers in your garden"/><StatChip icon={Leaf} color="sage" value={explored} label="explored papers"/><StatChip icon={Link2} color="lavender" value={edges?.length ?? '—'} label="idea connections"/></div>
    <section className="space-y-5">
      <div className="section-heading"><div><span className="eyebrow muted">A HOME FOR YOUR CURIOSITY</span><h2 className="font-display text-3xl mt-1">Your paper library <Flower size={24} color="#dcb2bb" className="inline -mt-1 ml-1"/></h2></div><p className="text-sm muted">{filtered.length} paper{filtered.length===1?'':'s'} found</p></div>
      <div className="library-controls">
        <div className="search-wrap"><Search size={19}/><input aria-label="Search papers" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search papers, notes, or keywords…"/></div>
        <div className="filters-row">
          <label className="select-wrap"><Tag size={16}/><select aria-label="Filter by topic" value={tag} onChange={e=>setTag(e.target.value)}><option>All topics</option>{tags.map(t=><option key={t}>{t}</option>)}</select><ChevronDown size={15}/></label>
          <label className="select-wrap"><Filter size={16}/><select aria-label="Filter by reading status" value={status} onChange={e=>setStatus(e.target.value)}>{['All statuses','To read','Reading','Explored'].map(s=><option key={s}>{s}</option>)}</select><ChevronDown size={15}/></label>
          <label className="select-wrap sort-wrap"><SlidersHorizontal size={16}/><select aria-label="Sort papers" value={sort} onChange={e=>setSort(e.target.value)}>{['Recently updated','Title A–Z','Year (newest)'].map(s=><option key={s}>{s}</option>)}</select><ChevronDown size={15}/></label>
          <div className="view-toggle"><button className={view==='grid'?'selected':''} aria-label="Grid view" title="Grid view" onClick={()=>setView('grid')}><Layers3 size={17}/></button><button className={view==='list'?'selected':''} aria-label="List view" title="List view" onClick={()=>setView('list')}><Menu size={17}/></button></div>
        </div>
      </div>
      {filtered.length ? <div className={view==='grid'?'cards-grid':'paper-list'}>{filtered.map(p=>view==='grid'?<PaperCard key={p.id} paper={p}/>:<PaperListRow key={p.id} paper={p}/>)}</div> :
        <div className="empty-state"><Flower size={54} color="#dac0bb"/><h3 className="font-display text-2xl">Nothing here yet, and that's okay.</h3><p>Try changing your filters or adding a paper you want to explore.</p><button className="btn-primary mt-3" onClick={onAdd}><Plus size={17}/> Add a paper</button></div>}
    </section>
  </div>
}
function PdfButton({paperId}) {
  const pdf = useLiveQuery(()=>db.pdfs.get(paperId), [paperId])
  const [open,setOpen] = useState(false)
  const [url,setUrl]=useState('')
  useEffect(()=>{
    if (!open || !pdf?.blob) {setUrl('');return}
    const created=URL.createObjectURL(pdf.blob)
    setUrl(created)
    return ()=>URL.revokeObjectURL(created)
  },[open,pdf])
  if (!pdf) return null
  return <><button className="btn-secondary" onClick={()=>setOpen(true)}><FileText size={16}/> View PDF</button><Modal open={open} onClose={()=>setOpen(false)} title={pdf.name} wide>
    <div className="pdf-display">{url ? <iframe src={url} title="Attached PDF" className="w-full h-full"/> : <p>Opening PDF…</p>}</div>
    <p className="text-xs muted mt-3">PDF stays on this device. Your browser's PDF viewer displays it.</p>
  </Modal></>
}
function PaperDetails({paper}) {
  const pdf = useLiveQuery(()=>db.pdfs.get(paper.id),[paper.id])
  const [form,setForm]=useState({...paper,tags:(paper.tags||[]).join(', ')})
  const [saved,setSaved]=useState('')
  const [confirm,setConfirm]=useState(false)
  const navigate=useNavigate()
  useEffect(()=>{setForm({...paper,tags:(paper.tags||[]).join(', ')})},[paper.id])
  const update=(key,val)=>{setSaved('');setForm(f=>({...f,[key]:val}))}
  const submit=async e=>{e.preventDefault();try{await savePaperInfo(paper.id,form);setSaved('Changes saved locally.')}catch(err){setSaved(err.message)}}
  const handlePdf=async e=>{
    const file=e.target.files?.[0];if (!file)return
    await db.pdfs.put({paperId:paper.id,name:file.name,blob:file,type:file.type||'application/pdf'})
    e.target.value=''
  }
  const remove=async()=>{await deletePaper(paper.id);navigate('/')}
  return <div className="max-w-4xl space-y-5">
    <form onSubmit={submit} className="paper-surface p-7 space-y-5">
      <div><h2 className="font-display text-2xl">About this paper</h2><p className="text-sm muted mt-1">All the useful little details, in one place.</p></div>
      <label className="field-label">Title<input required className="field mt-1" value={form.title} onChange={e=>update('title',e.target.value)}/></label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className="field-label">Authors<input className="field mt-1" value={form.authors||''} onChange={e=>update('authors',e.target.value)}/></label><label className="field-label">Year<input type="number" min="1800" max="2100" className="field mt-1" value={form.year||''} onChange={e=>update('year',e.target.value)}/></label></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><label className="field-label">Publication / venue<input className="field mt-1" value={form.venue||''} onChange={e=>update('venue',e.target.value)}/></label><label className="field-label">Reading status<select className="field mt-1" value={form.status} onChange={e=>update('status',e.target.value)}>{['To read','Reading','Explored'].map(s=><option key={s}>{s}</option>)}</select></label></div>
      <label className="field-label">Tags / paper keywords<input className="field mt-1" value={form.tags||''} onChange={e=>update('tags',e.target.value)}/><span className="field-help">Comma-separated. Used in the library filters.</span></label>
      <label className="field-label">Abstract<textarea className="field mt-1 min-h-32" value={form.abstract||''} onChange={e=>update('abstract',e.target.value)}/></label>
      <label className="field-label">Link to paper<input className="field mt-1" value={form.url||''} onChange={e=>update('url',e.target.value)}/></label>
      <label className="field-label">DOI<input className="field mt-1" value={form.doi||''} onChange={e=>update('doi',e.target.value)}/></label>
      <div className="flex flex-wrap gap-3 items-center justify-between"><button type="submit" className="btn-primary"><Check size={16}/> Save changes</button>{saved&&<span className="text-sm muted">{saved}</span>}</div>
    </form>
    <div className="paper-surface p-6 flex flex-wrap justify-between items-center gap-3"><div><strong className="block">Attached PDF</strong><span className="text-sm muted">{pdf?.name||'No PDF attached yet'}</span></div><label className="btn-secondary cursor-pointer"><FileUp size={16}/> {pdf?'Replace PDF':'Attach PDF'}<input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={handlePdf}/></label></div>
    <div className="paper-surface p-6 border border-rose-100"><div className="flex justify-between gap-4 flex-wrap"><div><strong className="text-ink">Remove paper</strong><p className="text-sm muted mt-1">Deletes its notes, recall answers, and attached PDF on this device.</p></div><button className="btn-secondary text-red-700" onClick={()=>setConfirm(v=>!v)}><Trash2 size={16}/> Remove</button></div>{confirm&&<div className="mt-4 bg-rose-50 rounded-xl p-4"><p className="text-sm mb-3">Are you sure? This cannot be undone unless you have a backup.</p><button className="btn-danger" onClick={remove}>Yes, delete paper</button><button className="btn-secondary ml-2" onClick={()=>setConfirm(false)}>Cancel</button></div>}</div>
  </div>
}
function PaperPage() {
  const {id}=useParams()
  const [params,setParams]=useSearchParams()
  const currentTab=['notes','recall','connections','details'].includes(params.get('tab'))?params.get('tab'):'notes'
  const paper=useLiveQuery(async()=>(await db.papers.get(id)) ?? null,[id])
  const notes=useLiveQuery(async()=>(await db.notes.get(id)) ?? {paperId:id,html:''},[id])
  if (paper===undefined || notes===undefined) return <div className="muted">Opening paper…</div>
  if (!paper) return <div className="empty-state"><p>That paper isn't in your library.</p><Link to="/" className="btn-primary">Back to library</Link></div>
  const tabs=[{id:'notes',label:'My notes',icon:Edit3},{id:'recall',label:'Active recall',icon:Brain},{id:'connections',label:'Connections',icon:Network},{id:'details',label:'Paper details',icon:Settings2}]
  const setTab=t=>setParams(t==='notes'?{}:{tab:t})
  return <div className="space-y-6">
    <Link to="/" className="back-link"><ChevronLeft size={17}/> Back to library</Link>
    <section className="paper-header paper-surface p-6 sm:p-8 relative overflow-hidden">
      <Flower className="absolute right-5 top-3 opacity-30 rotate-12" color="#e7c3c2" size={86}/>
      <div className="relative z-10"><div className="flex flex-wrap items-center gap-2"><span className="eyebrow"><FileText size={14}/> RESEARCH PAPER</span><span className={`status-pill ${statusColors[paper.status]||'unread'}`}>{paper.status}</span></div>
        <h1 className="font-display text-[clamp(1.8rem,3.5vw,3rem)] leading-[1.14] max-w-4xl mt-3">{paper.title}</h1>
        <p className="text-sm muted mt-3">{paper.authors||'Unknown authors'} {paper.year?` · ${paper.year}`:''} {paper.venue?` · ${paper.venue}`:''}</p>
        <div className="flex flex-wrap gap-2 mt-4">{(paper.tags||[]).map(t=><span className="tag-chip" key={t}>{t}</span>)}</div>
        <div className="flex flex-wrap gap-2 mt-5"><PdfButton paperId={id}/>{paper.url&&/^https?:\/\//i.test(paper.url)&&<a className="btn-secondary" href={paper.url} target="_blank" rel="noreferrer"><ExternalLink size={16}/> Original paper</a>}</div>
      </div>
    </section>
    <div className="tabs" role="tablist" aria-label="Paper workspace sections">
      {tabs.map(({id:tabId,label,icon:Icon})=><button key={tabId} role="tab" aria-selected={currentTab===tabId} className={`tab-item ${currentTab===tabId?'active':''}`} onClick={()=>setTab(tabId)}><Icon size={17}/>{label}</button>)}
    </div>
    {currentTab==='notes'&&<div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] gap-5 items-start">
      <RichNotes key={id} paperId={id} initialHtml={notes?.html||''}/>
      <aside className="notes-sidepaper paper-surface p-5"><div className="flex items-center gap-2"><Flower size={22} color="#d2a9b0"/><h3 className="font-display text-xl">Gentle prompts</h3></div><p className="text-sm muted mt-3">You don't have to write everything. One thought is enough.</p><ul className="prompt-list"><li>What surprised you?</li><li>What connects to something you know?</li><li>Can you draw the main idea?</li><li>What would you ask the authors?</li></ul><button className="btn-soft w-full justify-center mt-5" onClick={()=>setTab('recall')}><Brain size={16}/> Try active recall</button></aside>
    </div>}
    {currentTab==='recall'&&<Recall paperId={id}/>}
    {currentTab==='connections'&&<KnowledgeGraph focusPaperId={id} compact/>}
    {currentTab==='details'&&<PaperDetails key={id} paper={paper}/>}
  </div>
}
function GardenPage(){return <div className="space-y-7"><div className="flex items-center gap-3"><Flower color="#d8abb4" size={38}/><div><span className="eyebrow">IDEAS BLOOM TOGETHER</span><h1 className="font-display text-4xl mt-1">Knowledge garden</h1></div></div><div className="warm-banner"><p>Connect ideas from different papers. Your graph doesn't need to be perfect — it's a place to think visually.</p></div><KnowledgeGraph/></div>}
function ReviewPage(){
  const rows=useLiveQuery(()=>db.recall.toArray(),[])
  const papers=useLiveQuery(()=>db.papers.toArray(),[])
  const today=new Date().getTime()
  const due=(rows||[]).filter(r=>r.nextReview && new Date(r.nextReview).getTime()<=today)
  const upcoming=(rows||[]).filter(r=>r.nextReview && new Date(r.nextReview).getTime()>today)
  const map=Object.fromEntries((papers||[]).map(p=>[p.id,p]))
  return <div className="max-w-4xl space-y-7">
    <div><span className="eyebrow"><Brain size={15}/> SMALL MOMENTS OF REMEMBERING</span><h1 className="font-display text-4xl mt-2">Your review nook</h1><p className="muted mt-2">A calm place to revisit ideas you want to remember.</p></div>
    <div className="warm-banner flex items-center gap-4"><span className="stat-icon sage p-3"><Heart size={23}/></span><div><h2 className="font-display text-xl">No streaks. No falling behind.</h2><p className="text-sm muted mt-1">Even one question is a meaningful step.</p></div></div>
    <div className="flex gap-3 flex-wrap"><StatChip icon={Clock3} color="sand" value={due.length} label="questions ready"/><StatChip icon={CalendarDays} color="lavender" value={upcoming.length} label="scheduled for later"/></div>
    <h2 className="font-display text-2xl pt-2">Ready to revisit</h2>
    {due.length? <div className="space-y-3">{due.map(r=><Link key={r.id} to={`/paper/${r.paperId}?tab=recall`} className="review-row"><span className="question-number">{String(r.questionId+1).padStart(2,'0')}</span><div className="flex-1"><strong className="block">{QUESTIONS[r.questionId]}</strong><p className="text-sm muted mt-1">{map[r.paperId]?.title||'Paper not found'}</p></div><ChevronRight size={18}/></Link>)}</div>:
      <div className="empty-state"><Flower size={57} color="#dcb9be"/><h3 className="font-display text-2xl">All caught up for now.</h3><p>Open a paper's Active recall tab to answer a question or plan your next review.</p><Link className="btn-primary mt-3" to="/">Browse papers</Link></div>}
    {!!upcoming.length&&<div className="paper-surface p-6"><h3 className="font-display text-lg mb-3">Coming up gently</h3>{upcoming.sort((a,b)=>new Date(a.nextReview)-new Date(b.nextReview)).slice(0,6).map(r=><div key={r.id} className="upcoming-row"><span className="truncate">{map[r.paperId]?.title || 'Unknown paper'} · Q{r.questionId+1}</span><span>{formatDate(r.nextReview)}</span></div>)}</div>}
  </div>
}
export default function App(){
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#1d2521' : '#f8f7f2')
    try { window.localStorage.setItem('paper-garden-theme', theme) } catch { /* Storage can be disabled */ }
  }, [theme])
  const [addOpen,setAddOpen] = useState(false)
  const navigate=useNavigate()
  const [bootError,setBootError]=useState('')
  useEffect(()=>{if(!initialization) initialization=seedExampleLibrary();initialization.catch(e=>setBootError(e.message))},[])
  return <PageShell onAdd={()=>setAddOpen(true)} theme={theme} onToggleTheme={()=>setTheme(t=>t==='dark'?'light':'dark')}>
    {bootError&&<div className="notice mb-5">Local database could not be opened: {bootError}</div>}
    <Routes><Route path="/" element={<LibraryPage onAdd={()=>setAddOpen(true)}/>}/><Route path="/paper/:id" element={<PaperPage/>}/><Route path="/garden" element={<GardenPage/>}/><Route path="/review" element={<ReviewPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>
    <AddPaperModal open={addOpen} onClose={()=>setAddOpen(false)} onAdded={paper=>navigate(`/paper/${paper.id}`)}/>
  </PageShell>
}
