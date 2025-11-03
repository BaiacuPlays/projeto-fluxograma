
import React, { useRef } from 'react';
import { NodeData, NodeType } from '../types';
import { StartIcon, ProcessIcon, DecisionIcon, EndIcon, AddIcon, DownloadIcon, UploadIcon, TrashIcon, AnnotationIcon, SunIcon, MoonIcon, SaveIcon, FolderIcon } from './Icons';

interface SidebarProps {
  addNode: (type: NodeType) => void;
  autoConnect: boolean;
  setAutoConnect: React.Dispatch<React.SetStateAction<boolean>>;
  snapToGrid: boolean;
  setSnapToGrid: React.Dispatch<React.SetStateAction<boolean>>;
  onExportPNG: () => void;
  onExportJSON: () => void;
  onImportJSON: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  onAddAnnotation: () => void;
  theme: 'light' | 'dark';
  setTheme: React.Dispatch<React.SetStateAction<'light' | 'dark'>>;
  onSaveProject: () => void;
  isProjectDirty: boolean;
  onOpenProjectManager: () => void;
}

const ActionButton: React.FC<{ text: string, icon: React.ReactNode, onClick: () => void, disabled?: boolean }> = ({ text, icon, onClick, disabled = false }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className="flex items-center w-full p-3 text-left bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary-hover)] rounded-lg transition-all duration-200 shadow-sm border border-transparent hover:border-[var(--color-border)] transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
    >
        <div className="w-6 h-6 mr-4 flex-shrink-0 flex items-center justify-center">{icon}</div>
        <span className="flex-grow font-medium text-sm">{text}</span>
    </button>
);

const DangerActionButton: React.FC<{ text: string, icon: React.ReactNode, onClick: () => void }> = ({ text, icon, onClick }) => (
    <button
        onClick={onClick}
        className="flex items-center w-full p-3 text-left bg-red-900/70 hover:bg-red-800/80 text-red-300 hover:text-red-100 rounded-lg transition-all duration-200 shadow-sm border border-red-700/80 hover:border-red-600 transform hover:scale-105"
    >
        <div className="w-6 h-6 mr-4 flex-shrink-0 flex items-center justify-center">{icon}</div>
        <span className="flex-grow font-medium text-sm">{text}</span>
    </button>
);


const NodeButton: React.FC<{ type: NodeType, text: string, icon: React.ReactNode, onClick: () => void }> = ({ text, icon, onClick }) => {
    return (
        <button
            onClick={onClick}
            className="flex items-center w-full p-3 text-left bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-tertiary-hover)] rounded-lg transition-all duration-200 shadow-sm border border-transparent hover:border-[var(--color-border)] transform hover:scale-105"
        >
            <div className="w-8 h-8 mr-4 flex-shrink-0 flex items-center justify-center">{icon}</div>
            <span className="flex-grow font-medium">{text}</span>
            <AddIcon className="w-6 h-6 text-[var(--color-text-secondary)]" />
        </button>
    )
}

const Sidebar: React.FC<SidebarProps> = ({ 
    addNode, autoConnect, setAutoConnect, snapToGrid, setSnapToGrid, 
    onExportPNG, onExportJSON, onImportJSON, onClear, onAddAnnotation,
    theme, setTheme, onSaveProject, isProjectDirty, onOpenProjectManager
}) => {
  const importInputRef = useRef<HTMLInputElement>(null);
  
  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  return (
    <div className="flex-grow overflow-y-auto p-4 border-t border-[var(--color-border)] custom-scrollbar">
      <h2 className="text-lg font-semibold mb-4 text-[var(--color-text-secondary)]">Adicionar Blocos</h2>
      <div className="space-y-3">
        <NodeButton 
            text="Início" 
            type="start"
            icon={<StartIcon className="text-green-400" />} 
            onClick={() => addNode('start')} 
        />
        <NodeButton 
            text="Processo" 
            type="process"
            icon={<ProcessIcon className="text-blue-400" />} 
            onClick={() => addNode('process')} 
        />
        <NodeButton 
            text="Decisão" 
            type="decision"
            icon={<DecisionIcon className="text-purple-400" />} 
            onClick={() => addNode('decision')} 
        />
        <NodeButton 
            text="Fim" 
            type="end"
            icon={<EndIcon className="text-red-400" />} 
            onClick={() => addNode('end')} 
        />
      </div>

       <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
          <h3 className="text-base font-semibold mb-3 text-[var(--color-text-secondary)]">Ações</h3>
          <div className="space-y-3">
              <ActionButton 
                  text="Meus Projetos"
                  icon={<FolderIcon className="text-amber-400 w-5 h-5" />}
                  onClick={onOpenProjectManager}
              />
               <ActionButton 
                  text="Adicionar Anotação"
                  icon={<AnnotationIcon className="text-amber-400 w-5 h-5" />}
                  onClick={onAddAnnotation}
              />
              <ActionButton 
                  text="Salvar Projeto"
                  icon={<SaveIcon className="text-cyan-400 w-5 h-5" />}
                  onClick={onSaveProject}
                  disabled={!isProjectDirty}
              />
              <ActionButton 
                  text="Exportar para PNG"
                  icon={<DownloadIcon className="text-[var(--color-accent)]" />}
                  onClick={onExportPNG}
              />
              <ActionButton 
                  text="Exportar para JSON"
                  icon={<DownloadIcon className="text-[var(--color-accent)]" />}
                  onClick={onExportJSON}
              />
               <ActionButton 
                  text="Importar de JSON"
                  icon={<UploadIcon className="text-[var(--color-accent)]" />}
                  onClick={handleImportClick}
              />
               <input
                  type="file"
                  ref={importInputRef}
                  className="hidden"
                  accept=".json,application/json"
                  onChange={onImportJSON}
              />
          </div>
      </div>

       <div className="mt-6 pt-4 border-t border-red-500/30">
          <h3 className="text-base font-semibold mb-3 text-red-400">Zona de Perigo</h3>
          <div className="space-y-3">
               <DangerActionButton 
                  text="Limpar Fluxograma"
                  icon={<TrashIcon className="w-5 h-5" />}
                  onClick={onClear}
              />
          </div>
      </div>

       <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
          <h3 className="text-base font-semibold mb-3 text-[var(--color-text-secondary)]">Configurações</h3>
          <div className="flex items-center justify-between">
              <label htmlFor="theme-toggle" className="font-medium text-sm text-[var(--color-text-primary)] cursor-pointer">
                  Tema
                  <p className="text-xs text-[var(--color-text-secondary)] font-normal mt-1">Alternar entre claro e escuro</p>
              </label>
              <div className="flex items-center bg-[var(--color-bg)] p-1 rounded-full">
                  <button
                      onClick={() => setTheme('light')}
                      className={`p-1.5 rounded-full transition-colors ${theme === 'light' ? 'bg-[var(--color-accent)] text-white' : 'text-gray-400 hover:text-white'}`}
                      aria-label="Mudar para tema claro"
                  >
                      <SunIcon className="w-5 h-5" />
                  </button>
                   <button
                      onClick={() => setTheme('dark')}
                      className={`p-1.5 rounded-full transition-colors ${theme === 'dark' ? 'bg-[var(--color-accent)] text-white' : 'text-gray-500 hover:text-white'}`}
                      aria-label="Mudar para tema escuro"
                  >
                      <MoonIcon className="w-5 h-5" />
                  </button>
              </div>
          </div>
           <div className="flex items-center justify-between mt-4">
              <label htmlFor="auto-connect-toggle" className="font-medium text-sm text-[var(--color-text-primary)] cursor-pointer">
                  Conexão Automática
                  <p className="text-xs text-[var(--color-text-secondary)] font-normal mt-1">Ajustar setas ao mover blocos</p>
              </label>
              <button
                  role="switch"
                  aria-checked={autoConnect}
                  id="auto-connect-toggle"
                  onClick={() => setAutoConnect(prev => !prev)}
                  className={`${autoConnect ? 'bg-[var(--color-accent)]' : 'bg-gray-400 dark:bg-gray-600'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-secondary)]`}
              >
                  <span
                      aria-hidden="true"
                      className={`${autoConnect ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  />
              </button>
          </div>
           <div className="flex items-center justify-between mt-4">
              <label htmlFor="snap-to-grid-toggle" className="font-medium text-sm text-[var(--color-text-primary)] cursor-pointer">
                  Alinhar à Grade
                  <p className="text-xs text-[var(--color-text-secondary)] font-normal mt-1">Ajustar posição ao criar/mover</p>
              </label>
              <button
                  role="switch"
                  aria-checked={snapToGrid}
                  id="snap-to-grid-toggle"
                  onClick={() => setSnapToGrid(prev => !prev)}
                  className={`${snapToGrid ? 'bg-[var(--color-accent)]' : 'bg-gray-400 dark:bg-gray-600'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-bg-secondary)]`}
              >
                  <span
                      aria-hidden="true"
                      className={`${snapToGrid ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                  />
              </button>
          </div>
      </div>
    </div>
  );
};

export default Sidebar;
