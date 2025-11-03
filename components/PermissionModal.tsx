import React from 'react';
import { createPortal } from 'react-dom';
import { InfoIcon } from './Icons';

interface PermissionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRetry: () => void;
}

const PermissionModal: React.FC<PermissionModalProps> = ({ isOpen, onClose, onRetry }) => {
    if (!isOpen) {
        return null;
    }

    return createPortal(
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg-overlay)] backdrop-blur-sm"
            aria-labelledby="modal-title"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div 
                className="bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] rounded-xl shadow-xl border border-[var(--color-border)] p-6 m-4 max-w-md w-full transform transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start gap-4">
                    <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-cyan-900/50 sm:mx-0 sm:h-10 sm:w-10">
                        <InfoIcon className="h-6 w-6 text-[var(--color-accent)]" aria-hidden="true" />
                    </div>
                    <div className="flex-grow">
                        <h3 className="text-lg font-semibold leading-6" id="modal-title">
                            Permissão Necessária
                        </h3>
                        <div className="mt-2">
                            <p className="text-sm text-[var(--color-text-secondary)]">
                                Para colar os blocos, a aplicação precisa de acesso à sua área de transferência.
                                Parece que a permissão foi bloqueada pelo seu navegador.
                            </p>
                            <p className="mt-3 text-sm text-[var(--color-text-primary)]">
                                Você pode conceder a permissão clicando no ícone de cadeado (🔒) na barra de endereço do seu navegador e ativando a 'Área de Transferência'.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse sm:px-4">
                    <button
                        type="button"
                        className="inline-flex w-full justify-center rounded-md bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-80 sm:ml-3 sm:w-auto transition-opacity"
                        onClick={onRetry}
                    >
                        Tentar Novamente
                    </button>
                    <button
                        type="button"
                        className="mt-3 inline-flex w-full justify-center rounded-md bg-[var(--color-bg-tertiary)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] shadow-sm ring-1 ring-inset ring-[var(--color-border)] hover:bg-[var(--color-bg-tertiary-hover)] sm:mt-0 sm:w-auto transition-colors"
                        onClick={onClose}
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default PermissionModal;