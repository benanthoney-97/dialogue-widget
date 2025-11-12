import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/hooks/use-realtime-chat'

interface ChatMessageItemProps {
  message: ChatMessage
  showHeader: boolean
}

export const ChatMessageItem = ({ message, showHeader }: ChatMessageItemProps) => {
  // Determine alignment by sender role:
  // - support_team: left (agent/admin)
  // - user (or unspecified): right (end user)
  const isSupport = message.user.role === 'support_team'
  const headerName = isSupport ? 'Isabelle from Dialogue' : message.user.name

  return (
    <div className={`flex mt-2 ${isSupport ? 'justify-start' : 'justify-end'}`}>
      <div
        className={cn('max-w-[75%] w-fit flex flex-col gap-1', {
          'items-start': isSupport,
          'items-end': !isSupport,
        })}
      >
        {showHeader && (
          <div
            className={cn('flex items-center gap-2 text-xs px-3', {
              'justify-start': isSupport,
              'justify-end flex-row-reverse': !isSupport,
            })}
          >
            <span className={'font-medium'}>{headerName}</span>
            <span className="text-foreground/50 text-xs">
              {new Date(message.createdAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })}
            </span>
          </div>
        )}
        <div
          className={cn(
            'py-2 px-3 rounded-xl text-sm w-fit',
            isSupport ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground'
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  )
}

