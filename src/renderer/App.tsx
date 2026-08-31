// Sedrify — Shell placeholder
// This file will be replaced in UI Shell Sprint S-1.
// It exists only to confirm the Electron + React scaffold is working.

export default function App(): JSX.Element {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--background)',
        color: 'var(--foreground)',
        fontFamily: 'system-ui, sans-serif',
        gap: '12px'
      }}
    >
      <div
        style={{
          fontSize: '24px',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: 'var(--foreground)'
        }}
      >
        SEDRIFY
      </div>
      <div
        style={{
          fontSize: '13px',
          color: 'var(--muted-foreground)'
        }}
      >
        Scaffold ready — Sprint 0 ✓
      </div>
      <div
        style={{
          marginTop: '8px',
          fontSize: '11px',
          fontFamily: 'monospace',
          color: 'var(--muted-foreground)',
          padding: '4px 10px',
          border: '1px solid var(--border)',
          borderRadius: '3px',
          backgroundColor: 'var(--card)'
        }}
      >
        v0.0.1
      </div>
    </div>
  )
}
