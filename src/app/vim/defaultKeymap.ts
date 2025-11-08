import { Actions, Motions, VimModes } from './types'

type CommandType = 'motion' | 'action' | 'keyToKey' | 'operator' | 'operatorMotion' | 'search'

export interface KeyType {
  keys: string,
  type: CommandType
  motion?: Motions,
  mode?: VimModes,
  action?: Actions
}

export const defaultKeymap: KeyType[] = [
  // Motions
  { keys: 'H', type: 'motion', motion: Motions.FocusStart },
  { keys: 'h', type: 'motion', motion: Motions.MoveToLeft },
  { keys: 'L', type: 'motion', motion: Motions.FocusEnd },
  { keys: 'l', type: 'motion', motion: Motions.MoveToRight },
  { keys: 'w', type: 'motion', motion: Motions.WordJumpForward },
  { keys: 'b', type: 'motion', motion: Motions.WordJumpBackward },

  // Actions
  { keys: 'Escape', type: 'action', action: Actions.EnterNormalMode },
  { keys: 'i', type: 'action', action: Actions.EnterInsertMode, mode: VimModes.Normal },
  { keys: 'u', type: 'action', action: Actions.Undo, mode: VimModes.Normal },
  { keys: 'Ctrl-r', type: 'action', action: Actions.Redo },
]



