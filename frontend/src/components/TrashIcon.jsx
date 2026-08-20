// Shared trash-can glyph for icon-style "delete" buttons, matching
// PencilIcon's sizing/stroke conventions (14x14 inside a 32x32 .icon-button).
export default function TrashIcon() {
  return (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path
        d="M4 6h12M8 6V4.5A1.5 1.5 0 019.5 3h1A1.5 1.5 0 0112 4.5V6m-6.5 0v9A1.5 1.5 0 007 16.5h6a1.5 1.5 0 001.5-1.5V6M8.5 9v4.5M11.5 9v4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
