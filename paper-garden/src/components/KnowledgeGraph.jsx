import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { ReactFlow, Background, Controls, MiniMap, useNodesState, MarkerType } from '@xyflow/react'
import { Link2, Plus, Trash2, Flower2, MousePointer2, ArrowUpRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { db, uid } from '../lib/db.js'

export default function KnowledgeGraph({ focusPaperId = null, compact = false }) {
  const navigate = useNavigate()
  const storedNodes = useLiveQuery(() => db.graphNodes.toArray(), [])
  const storedEdges = useLiveQuery(() => db.graphEdges.toArray(), [])
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [selected, setSelected] = useState(null)
  const [concept, setConcept] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  const visibleIds = useMemo(() => {
    if (!focusPaperId || !storedEdges) return null
    const center = `paper-${focusPaperId}`
    const ids = new Set([center])
    storedEdges.forEach(e => { if (e.source === center) ids.add(e.target); if (e.target === center) ids.add(e.source) })
    return ids
  },[focusPaperId,storedEdges])

  useEffect(() => {
    if (!storedNodes) return
    setNodes(storedNodes.filter(n => !visibleIds || visibleIds.has(n.id)).map(n => ({
      id: n.id, position: { x:n.x, y:n.y }, data: { label:n.label, kind:n.kind, paperId:n.paperId },
      style: { background:n.kind==='paper'?'var(--node-paper-bg)':'var(--node-concept-bg)', border:`1.5px solid ${n.kind==='paper'?'var(--node-paper-border)':'var(--node-concept-border)'}`, borderRadius:17, padding:'15px 18px', fontFamily:'inherit', fontSize:13, fontWeight:650, color:'var(--node-ink)', boxShadow:'0 7px 20px var(--node-shadow)', minWidth:132, maxWidth:215, whiteSpace:'normal' },
    })))
  },[storedNodes,visibleIds,setNodes])

  const edges = useMemo(() => (storedEdges || []).filter(e => !visibleIds || (visibleIds.has(e.source)&&visibleIds.has(e.target))).map(e=>({
    ...e, type:'smoothstep', animated:false, style:{stroke:'var(--graph-edge)',strokeWidth:1.8}, markerEnd:{type:MarkerType.ArrowClosed, color:'var(--graph-edge)',width:12,height:12},
  })), [storedEdges,visibleIds])

  const onConnect = useCallback(async params => {
    if (!params.source || !params.target || params.source === params.target) return
    const exists = await db.graphEdges.where('source').equals(params.source).filter(e=>e.target === params.target).first()
    if (!exists) await db.graphEdges.add({id:uid(), source:params.source, target:params.target})
  },[])
  const onNodeDragStop = useCallback(async (_,node) => {
    await db.graphNodes.update(node.id,{x:node.position.x,y:node.position.y})
  },[])
  const addConcept = async e => {
    e.preventDefault()
    const label = concept.trim(); if (!label) return
    const id = `concept-${uid()}`
    const newNode = { id, paperId:null, kind:'concept', label, x:focusPaperId ? 360 : 250+Math.random()*260, y:focusPaperId? 80+Math.random()*220 : 80+Math.random()*250 }
    try {
      await db.graphNodes.put(newNode)
      if (focusPaperId) await db.graphEdges.add({id:uid(),source:`paper-${focusPaperId}`,target:id})
      setConcept(''); setAdding(false);setError('')
    } catch (err) {setError(err.message)}
  }
  const deleteConcept = async () => {
    if (!selected || selected.kind !== 'concept') return
    const matches = await db.graphEdges.toArray()
    await db.transaction('rw', db.graphNodes, db.graphEdges, async()=>{
      await db.graphEdges.bulkDelete(matches.filter(e=>e.source===selected.id || e.target===selected.id).map(e=>e.id))
      await db.graphNodes.delete(selected.id)
    })
    setSelected(null)
  }
  const selectedNode = storedNodes?.find(n=>n.id===selected?.id)
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-3 items-center justify-between">
      <div><h2 className="font-display text-2xl">{compact ? 'Ideas around this paper' : 'Your knowledge garden'}</h2><p className="text-sm muted mt-1">Drag ideas around. Connect them to show how they relate.</p></div>
      <button className="btn-primary" onClick={()=>setAdding(v=>!v)}><Plus size={16}/> Add concept</button>
    </div>
    {adding && <form onSubmit={addConcept} className="paper-surface p-4 flex flex-wrap gap-2 items-center">
      <input autoFocus className="field flex-1 min-w-[180px]" placeholder="e.g. feature extraction" value={concept} onChange={e=>setConcept(e.target.value)}/>
      <button className="btn-primary" type="submit">Add idea</button><button type="button" className="btn-secondary" onClick={()=>setAdding(false)}>Cancel</button>
      {error && <p className="text-red-600 text-sm w-full">{error}</p>}
    </form>}
    <div className={`graph-shell ${compact ? 'graph-compact' : ''}`}>
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onConnect={onConnect} onNodeDragStop={onNodeDragStop}
        onNodeClick={(_,node)=>setSelected({id:node.id,kind:node.data.kind,paperId:node.data.paperId})}
        onPaneClick={()=>setSelected(null)} fitView fitViewOptions={{padding:.25}} minZoom={.2} maxZoom={1.8}
        proOptions={{hideAttribution:true}}>
        <Background variant="dots" gap={22} size={1.3} color="var(--graph-dots)"/>
        <Controls position="bottom-left" showInteractive={false}/>
        {!compact && <MiniMap pannable zoomable position="bottom-right" nodeStrokeWidth={3} style={{background:'var(--graph-mini)',border:'1px solid var(--border)',borderRadius:13}}/>}
      </ReactFlow>
      <div className="graph-legend"><span className="dot bg-peach"/> Papers <span className="dot bg-sage-light ml-3"/> Concepts</div>
    </div>
    {selectedNode && <div className="paper-surface flex items-center gap-3 p-4">
      <span className="h-10 w-10 rounded-xl bg-mint flex items-center justify-center text-sage"><Flower2 size={20}/></span>
      <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{selectedNode.label}</p><p className="text-xs muted">{selectedNode.kind==='paper'?'Research paper':'Concept'}</p></div>
      {selectedNode.kind==='concept' ? <button className="btn-secondary small" onClick={deleteConcept}><Trash2 size={14}/> Delete concept</button> :
        <button className="btn-secondary small" onClick={()=>navigate(`/paper/${selectedNode.paperId}`)}>Open paper <ArrowUpRight size={14}/></button>}
    </div>}
    <p className="text-xs muted flex items-center gap-2"><MousePointer2 size={13}/> Drag from one node's small handle to another to connect them. <Link2 size={13}/> Click a node to inspect it.</p>
  </div>
}
