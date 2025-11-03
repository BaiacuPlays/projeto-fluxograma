import React, { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NodeData, EdgeData, NodeType, Position, FlowchartData, AnnotationData, Project, HistoryState } from './types';
import Canvas from './components/Canvas';
import Sidebar from './components/Sidebar';
import ContextMenu from './components/ContextMenu';
import PermissionModal from './components/PermissionModal';
import Tabs from './components/Tabs';
import { StartIcon, ProcessIcon, DecisionIcon } from './components/Icons';
import ProjectManagerModal from './components/ProjectManagerModal';

const defaultDimensions = {
    start: { width: 150, height: 60 },
    end: { width: 150, height: 60 },
    process: { width: 150, height: 70 },
    decision: { width: 160, height: 100 },
};

const nodeTypeTextMap: Record<NodeType, string> = {
    start: 'Início',
    process: 'Processo',
    decision: 'Decisão',
    end: 'Fim',
};

const createNewProject = (name: string): Project => {
    const emptyState: HistoryState = { nodes: [], edges: [], annotations: [] };
    return {
        id: `project-${Date.now()}`,
        name,
        ...emptyState,
        history: [emptyState],
        historyIndex: 0,
        isDirty: false,
    };
};

const sanitizeFlowchartData = (data: any): FlowchartData => {
    if (!data || typeof data !== 'object') {
        throw new Error('Formato de arquivo inválido.');
    }

    const seenNodeIds = new Set<string>();
    const sanitizedNodes = (Array.isArray(data.nodes) ? data.nodes : [])
        .map((n: any) => {
            if (!n || typeof n.id !== 'string' || !n.id.trim()) return null;
            if (seenNodeIds.has(n.id)) return null; 
            
            seenNodeIds.add(n.id);
            
            const position = n.position || {};
            const x = parseFloat(position.x);
            const y = parseFloat(position.y);
            if (!isFinite(x) || !isFinite(y)) return null;

            const width = n.width !== undefined ? parseFloat(n.width) : undefined;
            const height = n.height !== undefined ? parseFloat(n.height) : undefined;
            if ((width !== undefined && !isFinite(width)) || (height !== undefined && !isFinite(height))) return null;

            return {
                id: n.id,
                type: ['start', 'process', 'decision', 'end'].includes(n.type) ? n.type : 'process',
                text: typeof n.text === 'string' ? n.text : 'Node',
                position: { x, y },
                width: width,
                height: height,
                color: typeof n.color === 'string' ? n.color : undefined,
            };
        })
        .filter((n): n is NodeData => n !== null);

    const validNodeIds = new Set(sanitizedNodes.map(n => n.id));
    const seenEdgeIds = new Set<string>();
    const sanitizedEdges = (Array.isArray(data.edges) ? data.edges : [])
        .map((e: any) => {
            if (!e || typeof e.id !== 'string' || !e.id.trim()) return null;
            if (seenEdgeIds.has(e.id)) return null;

            if (typeof e.source !== 'string' || !e.source.trim() || typeof e.target !== 'string' || !e.target.trim()) return null;
            if (!validNodeIds.has(e.source) || !validNodeIds.has(e.target)) return null;
            
            seenEdgeIds.add(e.id);
            
            const sourceHandle = e.sourceHandle !== undefined ? parseInt(e.sourceHandle, 10) : undefined;
            const targetHandle = e.targetHandle !== undefined ? parseInt(e.targetHandle, 10) : undefined;
            if ((sourceHandle !== undefined && !isFinite(sourceHandle)) || (targetHandle !== undefined && !isFinite(targetHandle))) return null;

            return {
                id: e.id,
                source: e.source,
                target: e.target,
                label: typeof e.label === 'string' ? e.label : undefined,
                sourceHandle: sourceHandle,
                targetHandle: targetHandle,
            };
        })
        .filter((e): e is EdgeData => e !== null);
        
    const seenAnnotationIds = new Set<string>();
    const sanitizedAnnotations = (Array.isArray(data.annotations) ? data.annotations : [])
        .map((a: any) => {
            if (!a || typeof a.id !== 'string' || !a.id.trim()) return null;
            if (seenAnnotationIds.has(a.id)) return null;

            seenAnnotationIds.add(a.id);
            
            const position = a.position || {};
            const x = parseFloat(position.x);
            const y = parseFloat(position.y);
            if (!isFinite(x) || !isFinite(y)) return null;

            const width = a.width !== undefined ? parseFloat(a.width) : undefined;
            const height = a.height !== undefined ? parseFloat(a.height) : undefined;
            if ((width !== undefined && !isFinite(width)) || (height !== undefined && !isFinite(height))) return null;

            return {
                id: a.id,
                text: typeof a.text === 'string' ? a.text : 'Anotação',
                position: { x, y },
                width: width,
                height: height,
            };
        })
        .filter((a): a is AnnotationData => a !== null);


    return { nodes: sanitizedNodes, edges: sanitizedEdges, annotations: sanitizedAnnotations };
};

const loadInitialData = (): { projects: Project[], openProjectIds: string[], activeProjectId: string | null } => {
    try {
        const savedProjects = window.localStorage.getItem('flowchart-projects');
        const savedOpenIds = window.localStorage.getItem('flowchart-open-ids');
        const savedActiveId = window.localStorage.getItem('flowchart-active-project-id');

        let projects: Project[] = [];
        if (savedProjects) {
            const parsed = JSON.parse(savedProjects);
            if (Array.isArray(parsed)) {
                projects = parsed.map(p => ({ ...p, isDirty: p.isDirty ?? false }));
            }
        }

        if (projects.length === 0) {
            const firstProject = createNewProject('Meu Primeiro Fluxograma');
            return {
                projects: [firstProject],
                openProjectIds: [firstProject.id],
                activeProjectId: firstProject.id,
            };
        }

        let openProjectIds: string[] = [];
        if (savedOpenIds) {
            const parsed = JSON.parse(savedOpenIds);
            if (Array.isArray(parsed)) {
                openProjectIds = parsed.filter(id => projects.some(p => p.id === id));
            }
        }
        
        if (openProjectIds.length === 0) {
            openProjectIds = [projects[0].id];
        }

        let activeProjectId: string | null = null;
        if (savedActiveId && openProjectIds.includes(savedActiveId)) {
            activeProjectId = savedActiveId;
        } else {
            activeProjectId = openProjectIds[0] || null;
        }

        return { projects, openProjectIds, activeProjectId };

    } catch (error) {
        console.error("Falha ao carregar dados do armazenamento local.", error);
        const firstProject = createNewProject('Meu Primeiro Fluxograma');
        return {
            projects: [firstProject],
            openProjectIds: [firstProject.id],
            activeProjectId: firstProject.id,
        };
    }
};

const getInitialTheme = (): 'light' | 'dark' => {
  const savedTheme = window.localStorage.getItem('flowchart-theme');
  if (savedTheme === 'light' || savedTheme === 'dark') {
    return savedTheme;
  }
  return 'dark';
};

const saveDataToLocalStorage = (projects: Project[], openProjectIds: string[], activeId: string | null) => {
    try {
        localStorage.setItem('flowchart-projects', JSON.stringify(projects));
        localStorage.setItem('flowchart-open-ids', JSON.stringify(openProjectIds));
        if (activeId) {
            localStorage.setItem('flowchart-active-project-id', activeId);
        } else {
            localStorage.removeItem('flowchart-active-project-id');
        }
    } catch (error) {
        console.error("Falha ao salvar dados no armazenamento local.", error);
    }
};

const App: React.FC = () => {
  const [initialData] = useState(loadInitialData);
  const [projects, setProjects] = useState<Project[]>(initialData.projects);
  const [openProjectIds, setOpenProjectIds] = useState<string[]>(initialData.openProjectIds);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(initialData.activeProjectId);

  const activeProject = projects.find(p => p.id === activeProjectId);
  const openProjects = openProjectIds.map(id => projects.find(p => p.id === id)).filter((p): p is Project => !!p);
  
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedAnnotationIds, setSelectedAnnotationIds] = useState<Set<string>>(new Set());
  const [autoConnect, setAutoConnect] = useState<boolean>(true);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: NodeData } | null>(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [isProjectManagerOpen, setIsProjectManagerOpen] = useState(false);

  const isRestoring = useRef(false);
  const debounceTimeout = useRef<number | null>(null);

  useEffect(() => {
    document.fonts.ready.then(() => {
      setFontsLoaded(true);
    });
  }, []);
  
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    try {
      localStorage.setItem('flowchart-theme', theme);
    } catch (error) {
      console.error('Falha ao salvar o tema no localStorage.', error);
    }
  }, [theme]);
  
  // Auto-save projects and session state
  useEffect(() => {
    saveDataToLocalStorage(projects, openProjectIds, activeProjectId);
  }, [projects, openProjectIds, activeProjectId]);

  // History management
  useEffect(() => {
      if (!activeProject || isRestoring.current) {
        isRestoring.current = false;
        return;
      }

      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }

      debounceTimeout.current = window.setTimeout(() => {
        const currentState: HistoryState = { 
            nodes: activeProject.nodes, 
            edges: activeProject.edges, 
            annotations: activeProject.annotations 
        };
        const lastState = activeProject.history[activeProject.historyIndex];
        
        if (JSON.stringify(currentState) === JSON.stringify(lastState)) {
            return;
        }
        
        setProjects(prevProjects => prevProjects.map(p => {
            if (p.id === activeProjectId) {
                const newHistory = p.history.slice(0, p.historyIndex + 1);
                return {
                    ...p,
                    history: [...newHistory, currentState],
                    historyIndex: newHistory.length,
                    isDirty: true,
                };
            }
            return p;
        }));
      }, 500);

      return () => {
        if (debounceTimeout.current) {
          clearTimeout(debounceTimeout.current);
        }
      };
    }, [activeProject?.nodes, activeProject?.edges, activeProject?.annotations, activeProjectId]);

  const updateActiveProject = useCallback((updater: (project: Project) => Project) => {
    if (!activeProjectId) return;
    setProjects(prev => prev.map(p => p.id === activeProjectId ? updater(p) : p));
  }, [activeProjectId]);

  const handleUndo = useCallback(() => {
    if (!activeProject || activeProject.historyIndex <= 0) return;
    isRestoring.current = true;
    const newIndex = activeProject.historyIndex - 1;
    const prevState = activeProject.history[newIndex];
    updateActiveProject(p => ({ ...p, ...prevState, historyIndex: newIndex, isDirty: true }));
  }, [activeProject, updateActiveProject]);

  const handleRedo = useCallback(() => {
    if (!activeProject || activeProject.historyIndex >= activeProject.history.length - 1) return;
    isRestoring.current = true;
    const newIndex = activeProject.historyIndex + 1;
    const nextState = activeProject.history[newIndex];
    updateActiveProject(p => ({ ...p, ...nextState, historyIndex: newIndex, isDirty: true }));
  }, [activeProject, updateActiveProject]);

  const addNode = useCallback((type: NodeType) => {
    const GRID_SIZE = 20;
    const snap = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

    const initialPos = { x: Math.random() * 200 + 50, y: Math.random() * 100 + 50 };
    const finalPos = snapToGrid ? { x: snap(initialPos.x), y: snap(initialPos.y) } : initialPos;

    const newNode: NodeData = {
      id: `${type}-${Date.now()}${Math.round(Math.random() * 100)}`,
      type,
      text: nodeTypeTextMap[type],
      position: finalPos,
    };
    updateActiveProject(p => ({ ...p, nodes: [...p.nodes, newNode] }));
  }, [snapToGrid, updateActiveProject]);

  const addAnnotation = useCallback(() => {
    const GRID_SIZE = 20;
    const snap = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;

    const initialPos = { x: Math.random() * 200 + 50, y: Math.random() * 100 + 50 };
    const finalPos = snapToGrid ? { x: snap(initialPos.x), y: snap(initialPos.y) } : initialPos;
    
    const newAnnotation: AnnotationData = {
      id: `annotation-${Date.now()}`,
      text: 'Clique duas vezes para editar...',
      position: finalPos,
    };
    updateActiveProject(p => ({ ...p, annotations: [...p.annotations, newAnnotation] }));
  }, [snapToGrid, updateActiveProject]);

  const setNodes = useCallback((updater: React.SetStateAction<NodeData[]>) => {
    updateActiveProject(p => ({...p, nodes: typeof updater === 'function' ? updater(p.nodes) : updater }));
  }, [updateActiveProject]);
  const setEdges = useCallback((updater: React.SetStateAction<EdgeData[]>) => {
    updateActiveProject(p => ({...p, edges: typeof updater === 'function' ? updater(p.edges) : updater }));
  }, [updateActiveProject]);
  const setAnnotations = useCallback((updater: React.SetStateAction<AnnotationData[]>) => {
    updateActiveProject(p => ({...p, annotations: typeof updater === 'function' ? updater(p.annotations) : updater }));
  }, [updateActiveProject]);

  const updateNodePosition = useCallback((id: string, position: { x: number; y: number }) => {
    setNodes(prev => prev.map(node => node.id === id ? { ...node, position } : node));
  }, [setNodes]);

  const updateNodeText = useCallback((id: string, text: string) => {
    setNodes(prev => prev.map(node => node.id === id ? { ...node, text } : node));
  }, [setNodes]);

  const updateNodeDimensions = useCallback((id: string, dimensions: { width: number, height: number }) => {
    setNodes(prev => prev.map(node => node.id === id ? { ...node, ...dimensions } : node));
  }, [setNodes]);
  
  const deleteNode = useCallback((nodeId: string) => {
    updateActiveProject(p => ({
        ...p,
        nodes: p.nodes.filter(n => n.id !== nodeId),
        edges: p.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    }));
    setSelectedNodeIds(prev => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
    });
    closeContextMenu();
  }, [updateActiveProject]);

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges(eds => eds.filter(e => e.id !== edgeId));
    setSelectedEdgeId(null);
  }, [setEdges]);
  
  const updateEdgeLabel = useCallback((edgeId: string, label: string) => {
    setEdges(eds => eds.map(e => e.id === edgeId ? { ...e, label } : e));
  }, [setEdges]);

  const updateAnnotationPosition = useCallback((id: string, position: Position) => {
    setAnnotations(prev => prev.map(ann => ann.id === id ? { ...ann, position } : ann));
  }, [setAnnotations]);

  const updateAnnotationText = useCallback((id: string, text: string) => {
    setAnnotations(prev => prev.map(ann => ann.id === id ? { ...ann, text } : ann));
  }, [setAnnotations]);

  const updateAnnotationDimensions = useCallback((id: string, dimensions: { width: number, height: number }) => {
    setAnnotations(prev => prev.map(ann => ann.id === id ? { ...ann, ...dimensions } : ann));
  }, [setAnnotations]);

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations(prev => prev.filter(ann => ann.id !== id));
    setSelectedAnnotationIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
    });
  }, [setAnnotations]);

  const removeNodeConnections = useCallback((nodeId: string) => {
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    closeContextMenu();
  }, [setEdges]);

  const updateNodeType = useCallback((nodeId: string, type: NodeType) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, type, color: undefined } : n));
    closeContextMenu();
  }, [setNodes]);
  
  const updateNodeColor = useCallback((nodeId: string, color?: string) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, color } : n));
    closeContextMenu();
  }, [setNodes]);
  
  const resetNodeSize = useCallback((nodeId: string) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, width: undefined, height: undefined } : n));
    closeContextMenu();
  }, [setNodes]);

  const handleAddChild = useCallback((parentNodeId: string) => {
    if (!activeProject) return;
    const parentNode = activeProject.nodes.find(n => n.id === parentNodeId);
    if (!parentNode) return;

    const GRID_SIZE = 20;
    const snap = (val: number) => Math.round(val / GRID_SIZE) * GRID_SIZE;
    const parentHeight = parentNode.height ?? defaultDimensions[parentNode.type].height;
    const initialPos = { x: parentNode.position.x, y: parentNode.position.y + parentHeight + 80 };
    const finalPos = snapToGrid ? { x: snap(initialPos.x), y: snap(initialPos.y) } : initialPos;

    const newNode: NodeData = {
      id: `${parentNode.type}-${Date.now()}${Math.round(Math.random() * 100)}`,
      type: parentNode.type, text: nodeTypeTextMap[parentNode.type], position: finalPos, color: parentNode.color,
    };
    const newEdge: EdgeData = {
      id: `e-${parentNode.id}-${newNode.id}-${Date.now()}`, source: parentNode.id, target: newNode.id,
    };
    
    updateActiveProject(p => ({ ...p, nodes: [...p.nodes, newNode], edges: [...p.edges, newEdge] }));
    closeContextMenu();
  }, [activeProject, snapToGrid, updateActiveProject]);

  const handleCopy = useCallback(() => {
    if (selectedNodeIds.size === 0 || !activeProject) return;
    const selectedNodes = activeProject.nodes.filter(n => selectedNodeIds.has(n.id));
    const selectedEdges = activeProject.edges.filter(e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target));
    const dataToCopy = { type: 'flowchart-copy-data', data: { nodes: selectedNodes, edges: selectedEdges } };
    navigator.clipboard.writeText(JSON.stringify(dataToCopy)).catch(err => {
        console.error('Falha ao copiar:', err); alert('Não foi possível copiar os blocos.');
    });
  }, [activeProject, selectedNodeIds]);

  const handlePaste = useCallback(async () => {
    try {
        const permission = await navigator.permissions.query({ name: 'clipboard-read' as any });
        if (permission.state === 'denied') {
          setIsPermissionModalOpen(true);
          return;
        }
        const clipboardText = await navigator.clipboard.readText();
        const clipboardData = JSON.parse(clipboardText);
        if (clipboardData?.type !== 'flowchart-copy-data' || !clipboardData.data) return;
        const pastedFlowchart: FlowchartData = clipboardData.data;
        if (!Array.isArray(pastedFlowchart.nodes) || pastedFlowchart.nodes.length === 0) return;
        
        const idMap = new Map<string, string>();
        const newNodes: NodeData[] = [];
        const newEdges: EdgeData[] = [];
        pastedFlowchart.nodes.forEach(node => {
            const newId = `${node.type}-${Date.now()}${Math.round(Math.random() * 1000)}`;
            idMap.set(node.id, newId);
            newNodes.push({ ...node, id: newId, position: { x: node.position.x + 30, y: node.position.y + 30 } });
        });
        if (Array.isArray(pastedFlowchart.edges)) {
            pastedFlowchart.edges.forEach(edge => {
                const newSourceId = idMap.get(edge.source);
                const newTargetId = idMap.get(edge.target);
                if (newSourceId && newTargetId) {
                    newEdges.push({ ...edge, id: `e-${newSourceId}-${newTargetId}-${Date.now()}`, source: newSourceId, target: newTargetId });
                }
            });
        }
        updateActiveProject(p => ({ ...p, nodes: [...p.nodes, ...newNodes], edges: [...p.edges, ...newEdges] }));
        setSelectedNodeIds(new Set(newNodes.map(n => n.id)));
        setSelectedEdgeId(null);
        setSelectedAnnotationIds(new Set());
    } catch (err) { console.warn('Falha ao colar:', err); }
  }, [updateActiveProject]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        const activeEl = document.activeElement;
        const isTyping = activeEl && ['INPUT', 'TEXTAREA'].includes(activeEl.tagName);
        if (isTyping) return;
        const isMac = navigator.platform.toUpperCase().includes('MAC');
        const isCopy = (isMac ? e.metaKey : e.ctrlKey) && e.key === 'c';
        const isPaste = (isMac ? e.metaKey : e.ctrlKey) && e.key === 'v';
        const isDelete = e.key === 'Backspace' || e.key === 'Delete';
        const isUndo = (isMac ? e.metaKey : e.ctrlKey) && e.key === 'z';
        const isRedo = (isMac ? e.metaKey : e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'));
        if (isUndo) { e.preventDefault(); handleUndo(); return; }
        if (isRedo) { e.preventDefault(); handleRedo(); return; }
        if (isCopy) { e.preventDefault(); handleCopy(); return; }
        if (isPaste) { e.preventDefault(); handlePaste(); return; }
        if (isDelete) {
            e.preventDefault();
            if (selectedEdgeId) deleteEdge(selectedEdgeId);
            if (selectedNodeIds.size > 0) {
                const nodeIdsToDelete = Array.from(selectedNodeIds);
                updateActiveProject(p => ({
                    ...p,
                    nodes: p.nodes.filter(n => !nodeIdsToDelete.includes(n.id)),
                    edges: p.edges.filter(edge => !nodeIdsToDelete.includes(edge.source) && !nodeIdsToDelete.includes(edge.target))
                }));
                setSelectedNodeIds(new Set());
            }
             if (selectedAnnotationIds.size > 0) {
                const annotationIdsToDelete = Array.from(selectedAnnotationIds);
                setAnnotations(anns => anns.filter(a => !annotationIdsToDelete.includes(a.id)));
                setSelectedAnnotationIds(new Set());
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEdgeId, deleteEdge, selectedNodeIds, selectedAnnotationIds, handleCopy, handlePaste, handleUndo, handleRedo, updateActiveProject, setAnnotations]);

  const openContextMenu = (x: number, y: number, node: NodeData) => setContextMenu({ x, y, node });
  const closeContextMenu = () => setContextMenu(null);

  const handleExportPNG = useCallback(async () => {
    if (!activeProject) return;
    let toPng;
    try {
        const module = await import('https://esm.sh/html-to-image@1.11.11');
        toPng = module.toPng || (module.default && module.default.toPng);
        if (typeof toPng !== 'function') throw new Error('toPng not found');
    } catch (error) {
        alert(`Falha ao carregar biblioteca de exportação: ${error instanceof Error ? error.message : String(error)}`);
        return;
    }
    const svgElement = document.getElementById('flowchart-canvas');
    if (!svgElement) { alert('Canvas não encontrado.'); return; }
    const gElement = svgElement.querySelector<SVGGElement>('#flowchart-group');
    if (!gElement) { alert('Grupo do fluxograma não encontrado.'); return; }
    if (activeProject.nodes.length === 0 && activeProject.annotations.length === 0) {
        alert("Não há nada para exportar!"); return;
    }
    const PADDING = 50; let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    activeProject.nodes.forEach(node => {
        const nodeWidth = node.width ?? defaultDimensions[node.type].width;
        const nodeHeight = node.height ?? defaultDimensions[node.type].height;
        minX = Math.min(minX, node.position.x); minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + nodeWidth); maxY = Math.max(maxY, node.position.y + nodeHeight);
    });
    activeProject.annotations.forEach(ann => {
        minX = Math.min(minX, ann.position.x); minY = Math.min(minY, ann.position.y);
        maxX = Math.max(maxX, ann.position.x + (ann.width || 160)); maxY = Math.max(maxY, ann.position.y + (ann.height || 120));
    });
    const exportWidth = (maxX - minX) + PADDING * 2; const exportHeight = (maxY - minY) + PADDING * 2;
    const originalTransform = gElement.getAttribute('transform');
    gElement.setAttribute('transform', `translate(${-minX + PADDING}, ${-minY + PADDING}) scale(1)`);
    svgElement.classList.add('exporting');
    try {
        const fontURL = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
        const fontCSS = await fetch(fontURL).then(res => res.text());
        const dataUrl = await toPng(svgElement, {
            width: exportWidth, height: exportHeight,
            backgroundColor: theme === 'dark' ? '#111827' : '#F9FAFB', fontEmbedCSS: fontCSS,
        });
        const link = document.createElement('a');
        link.download = `${activeProject.name.replace(/\s+/g, '_') || 'fluxograma'}.png`;
        link.href = dataUrl; link.click();
    } catch (error) {
        alert(`Erro ao exportar PNG: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
        svgElement.classList.remove('exporting');
        if (originalTransform) gElement.setAttribute('transform', originalTransform);
        else gElement.removeAttribute('transform');
    }
}, [activeProject, theme]);

  const handleExportJSON = useCallback(() => {
    if (!activeProject) return;
    const data: FlowchartData = { nodes: activeProject.nodes, edges: activeProject.edges, annotations: activeProject.annotations };
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${activeProject.name.replace(/\s+/g, '_') || 'fluxograma'}.json`;
    link.href = url; link.click(); URL.revokeObjectURL(url);
  }, [activeProject]);

  const handleImportJSON = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const input = event.target;
    if (!file || !activeProjectId) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            if (typeof e.target?.result !== 'string') throw new Error('Falha ao ler o arquivo.');
            const sanitizedData = sanitizeFlowchartData(JSON.parse(e.target.result));
            if (window.confirm('Isso substituirá o fluxograma ATUAL. Deseja continuar?')) {
                const newState: HistoryState = { nodes: sanitizedData.nodes, edges: sanitizedData.edges, annotations: sanitizedData.annotations || [] };
                updateActiveProject(p => ({ ...p, ...newState, history: [newState], historyIndex: 0, isDirty: true }));
                setSelectedNodeIds(new Set()); setSelectedEdgeId(null); setSelectedAnnotationIds(new Set());
            }
        } catch (error) {
            alert(`Erro ao importar: ${error instanceof Error ? error.message : 'Erro'}`);
        } finally { if (input) input.value = ''; }
    };
    reader.onerror = () => { alert('Erro ao ler o arquivo.'); if (input) input.value = ''; };
    reader.readAsText(file);
  }, [activeProjectId, updateActiveProject]);
  
  const handleClear = useCallback(() => {
    if (window.confirm('Tem certeza que deseja limpar o fluxograma ATUAL?')) {
        const emptyState: HistoryState = { nodes: [], edges: [], annotations: [] };
        updateActiveProject(p => ({ ...p, ...emptyState, history: [emptyState], historyIndex: 0, isDirty: true }));
        setSelectedEdgeId(null); setSelectedNodeIds(new Set()); setSelectedAnnotationIds(new Set());
    }
  }, [updateActiveProject]);
  
  const handleAddProject = () => {
    const newProject = createNewProject(`Fluxograma ${projects.length + 1}`);
    setProjects(prev => [...prev, newProject]);
    setOpenProjectIds(prev => [...prev, newProject.id]);
    setActiveProjectId(newProject.id);
  };

  const handleCloseProject = useCallback((idToClose: string) => {
    setOpenProjectIds(currentOpenIds => {
        const newOpenIds = currentOpenIds.filter(id => id !== idToClose);
        
        if (activeProjectId === idToClose) {
            const closingIndex = currentOpenIds.findIndex(id => id === idToClose);
            const newActiveIndex = Math.max(0, closingIndex - 1);
            setActiveProjectId(newOpenIds[newActiveIndex] || newOpenIds[0] || null);
        }
        
        if (newOpenIds.length === 0 && projects.length > 0) {
            const firstProject = projects[0];
            setActiveProjectId(firstProject.id);
            return [firstProject.id];
        }

        return newOpenIds;
    });
  }, [activeProjectId, projects]);

  const handleRenameProject = (id: string, newName: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: newName, isDirty: true } : p));
  };

  const handleOpenProject = useCallback((idToOpen: string) => {
    if (!openProjectIds.includes(idToOpen)) {
        setOpenProjectIds(prev => [...prev, idToOpen]);
    }
    setActiveProjectId(idToOpen);
    setIsProjectManagerOpen(false);
  }, [openProjectIds]);

  const handleDeleteProject = useCallback((idToDelete: string) => {
    // This logic needs to be atomic to prevent inconsistent states.
    // We calculate the next state completely before setting it.
    
    const nextProjects = projects.filter(p => p.id !== idToDelete);
    const nextOpenIds = openProjectIds.filter(id => id !== idToDelete);
    
    // Case 1: We deleted the last project in existence.
    if (nextProjects.length === 0) {
      const newProject = createNewProject('Meu Primeiro Fluxograma');
      setProjects([newProject]);
      setOpenProjectIds([newProject.id]);
      setActiveProjectId(newProject.id);
      return;
    }
    
    // Case 2: The deleted project was NOT the active one.
    // The active ID is still valid and present in nextOpenIds.
    if (activeProjectId !== idToDelete) {
      setProjects(nextProjects);
      setOpenProjectIds(nextOpenIds);
      // activeProjectId does not change
      return;
    }
    
    // Case 3: The deleted project WAS the active one. Find a new active project.
    const closingIndex = openProjectIds.indexOf(idToDelete);
    const newActiveIndex = Math.max(0, closingIndex - 1); // Prefer tab to the left
    let nextActiveId = nextOpenIds[newActiveIndex] ?? nextOpenIds[0] ?? null;
    
    // Case 3a: Deleting the active project left no tabs open.
    if (nextActiveId === null) {
      // Open the first project from the remaining list.
      const firstProject = nextProjects[0];
      setProjects(nextProjects);
      setOpenProjectIds([firstProject.id]);
      setActiveProjectId(firstProject.id);
    } else {
      // Case 3b: Other tabs are still open, just switch to the new active one.
      setProjects(nextProjects);
      setOpenProjectIds(nextOpenIds);
      setActiveProjectId(nextActiveId);
    }
  }, [projects, openProjectIds, activeProjectId]);
  
  const onSelectProject = useCallback((id: string) => {
    setActiveProjectId(id);
    setSelectedNodeIds(new Set());
    setSelectedAnnotationIds(new Set());
    setSelectedEdgeId(null);
  }, []);

  const handleSaveProject = useCallback(() => {
    if (!activeProjectId) return;
    setProjects(currentProjects => {
        const updatedProjects = currentProjects.map(p => 
            p.id === activeProjectId ? { ...p, isDirty: false } : p
        );
        saveDataToLocalStorage(updatedProjects, openProjectIds, activeProjectId);
        return updatedProjects;
    });
  }, [activeProjectId, openProjectIds]);

  return (
    <div className="flex h-screen font-sans bg-[var(--color-bg)] text-[var(--color-text-primary)] overflow-hidden" onClick={closeContextMenu}>
      <div className="w-72 flex flex-col bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] shadow-lg">
          <header className="p-4 border-b border-[var(--color-border)]">
              <h1 className="text-2xl font-bold text-[var(--color-accent)]">Criador de Fluxogramas</h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">Crie, visualize e edite seus processos.</p>
          </header>
          
          <Sidebar 
            addNode={addNode} 
            autoConnect={autoConnect}
            setAutoConnect={setAutoConnect}
            snapToGrid={snapToGrid}
            setSnapToGrid={setSnapToGrid}
            onExportPNG={handleExportPNG}
            onExportJSON={handleExportJSON}
            onImportJSON={handleImportJSON}
            onClear={handleClear}
            onAddAnnotation={addAnnotation}
            theme={theme}
            setTheme={setTheme}
            onSaveProject={handleSaveProject}
            isProjectDirty={activeProject?.isDirty ?? false}
            onOpenProjectManager={() => setIsProjectManagerOpen(true)}
          />
          
      </div>
      <main className="flex-1 flex flex-col relative bg-[var(--color-bg)]">
         <Tabs 
            projects={openProjects}
            activeProjectId={activeProjectId}
            onSelectProject={onSelectProject}
            onAddProject={handleAddProject}
            onCloseProject={handleCloseProject}
            onRenameProject={handleRenameProject}
         />
        <div className="flex-grow relative">
            <Canvas
              nodes={activeProject?.nodes || []}
              edges={activeProject?.edges || []}
              annotations={activeProject?.annotations || []}
              setNodes={setNodes}
              setEdges={setEdges}
              setAnnotations={setAnnotations}
              updateNodePosition={updateNodePosition}
              updateNodeText={updateNodeText}
              updateNodeDimensions={updateNodeDimensions}
              deleteNode={deleteNode}
              updateAnnotationPosition={updateAnnotationPosition}
              updateAnnotationText={updateAnnotationText}
              updateAnnotationDimensions={updateAnnotationDimensions}
              deleteAnnotation={deleteAnnotation}
              autoConnect={autoConnect}
              onOpenContextMenu={openContextMenu}
              selectedEdgeId={selectedEdgeId}
              setSelectedEdgeId={setSelectedEdgeId}
              deleteEdge={deleteEdge}
              updateEdgeLabel={updateEdgeLabel}
              fontsLoaded={fontsLoaded}
              selectedNodeIds={selectedNodeIds}
              setSelectedNodeIds={setSelectedNodeIds}
              selectedAnnotationIds={selectedAnnotationIds}
              setSelectedAnnotationIds={setSelectedAnnotationIds}
              snapToGrid={snapToGrid}
            />
            <div className="absolute bottom-4 right-4 bg-[var(--color-bg-secondary)]/80 backdrop-blur-sm p-3 rounded-lg text-xs text-[var(--color-text-secondary)] shadow-lg flex items-center gap-6 border border-[var(--color-border)]">
                <div className="flex items-center gap-2"><StartIcon className="w-4 h-4 text-green-400"/> Início/Fim</div>
                <div className="flex items-center gap-2"><ProcessIcon className="w-4 h-4 text-blue-400"/> Processo</div>
                <div className="flex items-center gap-2"><DecisionIcon className="w-4 h-4 text-purple-400"/> Decisão</div>
            </div>
        </div>
      </main>
      {contextMenu && createPortal(
        <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            node={contextMenu.node}
            onClose={closeContextMenu}
            onDelete={deleteNode}
            onRemoveConnections={removeNodeConnections}
            onChangeType={updateNodeType}
            onChangeColor={updateNodeColor}
            onResetSize={resetNodeSize}
            onAddChild={handleAddChild}
        />,
        document.body
      )}
      <PermissionModal
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        onRetry={() => {
            setIsPermissionModalOpen(false);
            handlePaste();
        }}
      />
      <ProjectManagerModal
        isOpen={isProjectManagerOpen}
        onClose={() => setIsProjectManagerOpen(false)}
        projects={projects}
        onOpenProject={handleOpenProject}
        onDeleteProject={handleDeleteProject}
        onRenameProject={handleRenameProject}
        onNewProject={() => {
            handleAddProject();
            setIsProjectManagerOpen(false);
        }}
      />
    </div>
  );
};

export default App;