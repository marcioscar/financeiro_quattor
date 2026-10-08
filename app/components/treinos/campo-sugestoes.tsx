import { useId, useState, type ReactNode } from "react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";

/**
 * Campo de texto livre com lista de sugestões embaixo (estilo autocomplete).
 * Diferente do Combobox, aceita qualquer texto: a sugestão só ajuda a digitar.
 */
export function CampoSugestoes<T>({
	value,
	onChange,
	onEscolher,
	sugestoes,
	chave,
	renderItem,
	placeholder,
	disabled,
	autoFocus,
	onEnter,
	className,
	"aria-label": ariaLabel,
}: {
	value: string;
	onChange: (v: string) => void;
	onEscolher: (item: T) => void;
	/** recebe o texto atual e devolve as sugestões a mostrar */
	sugestoes: (texto: string) => T[];
	chave: (item: T) => string;
	renderItem: (item: T) => ReactNode;
	placeholder?: string;
	disabled?: boolean;
	autoFocus?: boolean;
	/** Enter sem sugestão destacada (ex.: pular para o próximo exercício) */
	onEnter?: () => void;
	className?: string;
	"aria-label"?: string;
}) {
	const [aberto, setAberto] = useState(false);
	const [ativo, setAtivo] = useState(-1);
	const listaId = useId();
	const itens = aberto ? sugestoes(value) : [];

	function escolher(item: T) {
		onEscolher(item);
		setAberto(false);
		setAtivo(-1);
	}

	function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setAberto(true);
			setAtivo((i) => Math.min(i + 1, itens.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setAtivo((i) => Math.max(i - 1, -1));
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (ativo >= 0 && itens[ativo]) escolher(itens[ativo]);
			else {
				setAberto(false);
				onEnter?.();
			}
		} else if (e.key === "Escape") {
			setAberto(false);
		}
	}

	return (
		<div className={cn("relative", className)}>
			<Input
				value={value}
				placeholder={placeholder}
				disabled={disabled}
				autoFocus={autoFocus}
				aria-label={ariaLabel}
				role='combobox'
				aria-expanded={itens.length > 0}
				aria-controls={listaId}
				autoComplete='off'
				onChange={(e) => {
					onChange(e.target.value);
					setAberto(true);
					setAtivo(-1);
				}}
				onFocus={() => setAberto(true)}
				onBlur={() => setAberto(false)}
				onKeyDown={onKeyDown}
			/>
			{itens.length > 0 && (
				<ul
					id={listaId}
					role='listbox'
					className='absolute top-full right-0 left-0 z-50 mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md'>
					{itens.map((item, i) => (
						<li
							key={chave(item)}
							role='option'
							aria-selected={i === ativo}
							// mousedown para escolher antes do blur fechar a lista
							onMouseDown={(e) => {
								e.preventDefault();
								escolher(item);
							}}
							onMouseEnter={() => setAtivo(i)}
							className={cn(
								"flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
								i === ativo && "bg-accent text-accent-foreground",
							)}>
							{renderItem(item)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
