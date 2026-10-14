import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './i18n' // Import i18n

// Browser page translation (e.g. Chrome's "Translate to English") swaps
// React-owned text nodes for its own <font> wrappers, so React's later
// removeChild/insertBefore calls target nodes that are no longer where it
// left them and throw "The node to be removed is not a child of this node",
// crashing the whole screen. Skip those mismatched calls instead
// (facebook/react#11538).
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) return child;
    return originalRemoveChild.call(this, child) as T;
  };
  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(this: Node, newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) return newNode;
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

// No StrictMode: its dev-only double-mount/double-effect behavior triggers a
// known TipTap crash (destroyed editor instance still referenced by a stale
// keyboard-shortcut handler -> "Cannot read properties of null (reading
// 'commands')"), most visible on pages that mount several RichTextInputs at
// once (e.g. the Events create form). StrictMode has no effect in production.
createRoot(document.getElementById('root')!).render(
  <App />,
)
