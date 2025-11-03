
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Project } from '../types';
import { AddIcon, PencilIcon, TrashIcon } from './Icons';

interface ProjectManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    projects: Project[];
    onOpenProject: (id: string) => void;
    onDeleteProject: (id: string) => void;
    onRenameProject: (id: string, newName: string) => void;
    onNewProject: () => void;
}

const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
    isOpen,
    onClose,
    projects,
    onOpenProject,
    onDeleteProject,
    onRenameProject,
    onNewProject
}) => {
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (renamingId && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingId]);
    
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);


    const handleRenameSubmit = () => {
        if (renamingId && renameValue.trim()) {
            onRenameProject(renamingId, renameValue.trim());
        }
        setRenamingId(null);
    };

    const handleRenameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRenameSubmit();
        } else if (e.key === 'Escape') {
            setRenamingId(null);
        }
    };
    
    const handleDelete = (id: string, name: string) => {
        if (window.confirm(`Tem certeza de que deseja excluir permanentemente o projeto "${name}"? Esta ação não pode ser desfeita.`)) {
            onDeleteProject(id);
        }
    }

    if (!isOpen) return null;

    return createPortal(
        <div 
            className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--color-bg-overlay)] backdrop-blur-sm"
            onClick={onClose}
        >
            <div 
                className="bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-xl shadow-2xl border border-[var(--color-border)] p-6 m-4 w-full max-w-2xl transform transition-all flex flex-col"
                style={{ maxHeight: '80vh' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-6 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">Gerenciador de Projetos</h2>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onNewProject}
                            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white font-semibold rounded-lg hover:opacity-80 transition-opacity"
                        >
                            <AddIcon className="w-5 h-5"/>
                            <span>Novo Projeto</span>
                        </button>
                        <button 
                            onClick={onClose}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary-hover)] hover:text-white transition-colors"
                            aria-label="Fechar"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar -mr-3 pr-3">
                    <ul className="space-y-2">
                        {projects.length > 0 ? projects.map(project => (
                            <li 
                                key={project.id} 
                                className="bg-[var(--color-bg-tertiary)] p-3 rounded-lg flex items-center justify-between transition-colors hover:bg-[var(--color-bg-tertiary-hover)]"
                            >
                                {renamingId === project.id ? (
                                    <input
                                        ref={renameInputRef}
                                        type="text"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={handleRenameSubmit}
                                        onKeyDown={handleRenameKeyDown}
                                        className="flex-grow bg-[var(--color-bg)] text-base font-medium focus:outline-none ring-2 ring-[var(--color-accent)] rounded-md px-2 py-1"
                                    />
                                ) : (
                                    <span className="flex-grow font-medium truncate">{project.name}</span>
                                )}

                                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                    <button 
                                        onClick={() => onOpenProject(project.id)}
                                        className="px-4 py-1.5 text-sm font-semibold bg-[var(--color-bg)] rounded-md hover:bg-[var(--color-bg-secondary)] border border-[var(--color-border)] transition-colors"
                                    >
                                        Abrir
                                    </button>
                                    <button 
                                        onClick={() => { setRenamingId(project.id); setRenameValue(project.name); }}
                                        className="p-2 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] hover:text-[var(--color-accent)] transition-colors"
                                        aria-label="Renomear projeto"
                                    >
                                        <PencilIcon className="w-5 h-5"/>
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(project.id, project.name)}
                                        className="p-2 rounded-md text-[var(--color-text-secondary)] hover:bg-red-900/40 hover:text-red-400 transition-colors"
                                        aria-label="Excluir projeto"
                                    >
                                        <TrashIcon className="w-5 h-5"/>
                                    </button>
                                </div>
                            </li>
                        )) : (
                            <div className="text-center py-10 text-[var(--color-text-secondary)]">
                                <p>Nenhum projeto encontrado.</p>
                                <p className="text-sm mt-1">Clique em "Novo Projeto" para começar.</p>
                            </div>
                        )}
                    </ul>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ProjectManagerModal;
