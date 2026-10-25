import { channelIcon, mergeSupportChannels, supportChannelHref } from './lib/supportChannels'

// Storefront list of the admin-published support channels. Shared by the mobile
// account sheet and the desktop Help & Support card so both customers see the
// same live list, loading state and retry path.
//   compact — one-line rows without the per-row action label (desktop card).
//   onNotify — called with a label when a channel is opened, for screen readers.
export default function SupportChannelList({
  channels = [],
  loading = false,
  error = '',
  onRetry,
  tr = (text) => text,
  onNotify,
  compact = false
}) {
  const activeChannels = mergeSupportChannels(channels)

  return (
    <div className={compact ? 'support-channels-list is-compact' : 'support-channels-list'}>
      {loading && activeChannels.length === 0 && (
        <div className="support-channels-state is-loading" role="status">
          {tr('Loading support channels…')}
        </div>
      )}

      {error && (
        <div className="support-channels-state is-error" role="alert">
          <span>{tr(error)}</span>
          <button
            type="button"
            className="support-channels-retry"
            onClick={() => onRetry?.()}
          >
            {tr('Retry')}
          </button>
        </div>
      )}

      {activeChannels.map((channel) => {
        const name = channel.channel || channel.name || ''
        const href = supportChannelHref(channel)
        const details = [channel.accountName, channel.username].filter(Boolean).join(' · ')
        const copy = (
          <>
            <div className="support-channel-copy">
              <strong>{channelIcon(channel)} {tr(name)}</strong>
              {details && <span>{details}</span>}
              {channel.description && <p>{tr(channel.description)}</p>}
            </div>
            {compact ? (
              href && <span className="support-channel-action" aria-hidden="true">↗</span>
            ) : (
              <span className="support-channel-action">
                {href ? tr('Contact / Open') : tr('Contact details unavailable')}
              </span>
            )}
          </>
        )
        return href ? (
          <a
            key={channel.id || name}
            className="support-channel"
            href={href}
            aria-label={details ? `${tr(name)}: ${details}` : undefined}
            target={/^(tel:|mailto:)/i.test(href) ? undefined : '_blank'}
            rel="noopener noreferrer"
            onClick={() => onNotify?.(`${name}${details ? `: ${details}` : ''}`)}
          >
            {copy}
          </a>
        ) : (
          <div key={channel.id || name} className="support-channel is-unavailable">
            {copy}
          </div>
        )
      })}

      {!loading && activeChannels.length === 0 && (
        <div className="support-channels-empty">
          <h4>{tr('No support channels available')}</h4>
          <p>{tr('Please check back later for shop contact options.')}</p>
        </div>
      )}
    </div>
  )
}
