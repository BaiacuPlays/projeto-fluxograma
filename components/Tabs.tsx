
import React, { useState, useRef, useEffect } from 'react';
import { Project } from '../types';
import { AddIcon } from './Icons';

interface TabsProps {
    projects: Project[];
    activeProjectId: string | null;
    onSelectProject: (id: string) => void;
    onAddProject: () => void;
    onCloseProject: (id: string) => void;
    onRenameProject: (id: string, newName: string) => void;
}

const Tabs: React.FC<TabsProps> = ({ projects, activeProjectId, onSelectProject, onAddProject, onCloseProject, onRenameProject }) => {
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);
    const tabsContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (renamingId && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingId]);
    
    useEffect(() => {
        const activeTab = tabsContainerRef.current?.querySelector('.active-tab');
        if (activeTab) {
            activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [activeProjectId]);


    const handleDoubleClick = (project: Project) => {
        setRenamingId(project.id);
        setRenameValue(project.name);
    };

    const handleRenameBlur = () => {
        if (renamingId && renameValue.trim()) {
            onRenameProject(renamingId, renameValue.trim());
        }
        setRenamingId(null);
    };

    const handleRenameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRenameBlur();
        } else if (e.key === 'Escape') {
            setRenamingId(null);
        }
    };
    
    const handleClose = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        const projectToClose = projects.find(p => p.id === id);
        if (projectToClose && projectToClose.isDirty) {
            if (window.confirm('Este projeto tem alterações não salvas. Deseja fechar mesmo assim?')) {
                onCloseProject(id);
            }
        } else {
            onCloseProject(id);
        }
    };

    return (
        <div className="flex-shrink-0 w-full bg-[var(--color-bg)] border-b border-[var(--color-border)] flex items-center shadow-md">
            <div ref={tabsContainerRef} className="flex-grow flex items-center overflow-x-auto overflow-y-hidden h-12 tabs-scrollbar">
                {projects.map(project => {
                    const isActive = project.id === activeProjectId;
                    return (
                        <div
                            key={project.id}
                            onClick={() => onSelectProject(project.id)}
                            onDoubleClick={() => handleDoubleClick(project)}
                            className={`flex-shrink-0 flex items-center justify-between px-4 h-full cursor-pointer border-r border-t-2 transition-colors duration-200 group relative ${
                                isActive 
                                ? 'bg-[var(--color-bg-secondary)] border-[var(--color-border)] border-t-[var(--color-accent)]' 
                                : 'border-transparent hover:bg-[var(--color-bg-secondary)]/50'
                            } ${isActive ? 'active-tab' : ''}`}
                            style={{ minWidth: '150px', maxWidth: '220px' }}
                        >
                            {renamingId === project.id ? (
                                <input
                                    ref={renameInputRef}
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onBlur={handleRenameBlur}
                                    onKeyDown={handleRenameKeyDown}
                                    className="w-full bg-transparent text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] rounded-sm p-0.5 -ml-0.5"
                                />
                            ) : (
                                <div className="flex items-center truncate">
                                    <span className={`text-sm font-medium truncate ${isActive ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]'}`}>
                                        {project.name}
                                    </span>
                                    {project.isDirty && <span className="ml-2 w-2 h-2 bg-cyan-400 rounded-full flex-shrink-0" title="Alterações não salvas"></span>}
                                </div>
                            )}
                            <button 
                                onClick={(e) => handleClose(e, project.id)}
                                className="ml-3 w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-[var(--color-text-secondary)] opacity-50 hover:opacity-100 hover:bg-[var(--color-bg-tertiary-hover)] hover:text-white transition-all duration-200"
                                aria-label={`Fechar ${project.name}`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    );
                })}
            </div>
             <button 
                onClick={onAddProject}
                className="flex-shrink-0 w-12 h-12 flex items-center justify-center bg-[var(--color-bg)] hover:bg-[var(--color-bg-secondary)]/50 border-l border-[var(--color-border)] transition-colors duration-200"
                aria-label="Adicionar novo fluxograma"
            >
                <AddIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
            </button>
        </div>
    );
};

export default Tabs;