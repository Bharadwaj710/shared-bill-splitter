type HomeSelectorProps = {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
}

export function HomeSelector({ value, onChange, onSubmit, disabled }: HomeSelectorProps) {
  return (
    <form
      className="home-selector"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label htmlFor="home-id">Home ID</label>
      <div className="home-selector__controls">
        <input
          id="home-id"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Paste a home ID"
          autoComplete="off"
        />
        <button type="submit" disabled={disabled || value.trim().length === 0}>
          {disabled ? 'Loading…' : 'Open home'}
        </button>
      </div>
    </form>
  )
}
