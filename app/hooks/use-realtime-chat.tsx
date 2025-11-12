'use client'

import { createClient } from '@/lib/supabase/client'
import { useCallback, useEffect, useMemo, useState } from 'react'

interface UseRealtimeChatProps {
  roomName: string
  username?: string
  roomId?: string
  clientId?: string
  senderRoleOverride?: 'user' | 'support_team'
}

export interface ChatMessage {
  id: string
  content: string
  user: {
    id: string
    name: string
    role?: string | null
  }
  createdAt: string
  updatedAt?: string | null
  metadata?: Record<string, unknown> | null
}

const EVENT_MESSAGE_TYPE = 'message'

type ProfileRecord = {
  id: string
  client_id: string | null
  display_name: string | null
  role: string | null
}

type RoomPayload = {
  room?: {
    id: string
    clientId: string
    userId: string | null
    name: string | null
    createdAt: string | null
    updatedAt: string | null
  }
}

type MessagesPayload = {
  messages?: ChatMessage[]
}

interface CurrentUser {
  id: string
  clientId: string | null
  name: string
  role: string | null
}

function sortMessages(input: ChatMessage[]) {
  return [...input].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function useRealtimeChat({
  roomName,
  username,
  roomId,
  clientId,
  senderRoleOverride,
}: UseRealtimeChatProps) {
  const supabase = useMemo(() => createClient(), [])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [channel, setChannel] = useState<ReturnType<typeof supabase.channel> | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [room, setRoom] = useState<{ id: string; name: string | null } | null>(null)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  const appendMessage = useCallback((incoming: ChatMessage) => {
    setMessages((current) => {
      if (current.some((message) => message.id === incoming.id)) {
        return current
      }

      return sortMessages([...current, incoming])
    })
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadUserContext() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.user) {
          if (isMounted) {
            setCurrentUser(null)
          }
          return
        }

        const authUser = session.user
        const fallbackName =
          username?.trim() && username.trim().length > 0
            ? username.trim()
            : (authUser.user_metadata?.display_name as string | undefined) ??
              (authUser.user_metadata?.full_name as string | undefined) ??
              authUser.email ??
              authUser.id

        const metadataClientId =
          (authUser.app_metadata?.client_id as string | undefined) ??
          (authUser.user_metadata?.client_id as string | undefined) ??
          null

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, client_id, display_name, role')
          .eq('id', authUser.id)
          .maybeSingle<ProfileRecord>()

        if (profileError) {
          console.error('[live-chat] Failed to load profile', profileError)
        }

        if (!isMounted) {
          return
        }

        setCurrentUser({
          id: authUser.id,
          clientId: profile?.client_id ?? metadataClientId,
          name: profile?.display_name ?? fallbackName,
          role: profile?.role ?? null,
        })
      } catch (error) {
        console.error('[live-chat] Unable to initialise user context', error)
        if (isMounted) {
          setCurrentUser(null)
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false)
        }
      }
    }

    loadUserContext()

    return () => {
      isMounted = false
    }
  }, [supabase, username])

  useEffect(() => {
    let isMounted = true

    async function bootstrapRoom() {
      const existingRoomId = roomId?.trim()

      if (existingRoomId) {
        try {
          if (!isMounted) return
          setRoom({ id: existingRoomId, name: roomName ?? null })

          const messagesResponse = await fetch(`/api/live-chat/rooms/${existingRoomId}/messages`)

          if (!messagesResponse.ok) {
            console.error('[live-chat] Failed to load room messages', await messagesResponse.text())
            return
          }

          const messagesPayload = (await messagesResponse.json()) as MessagesPayload

          if (!isMounted) return
          if (Array.isArray(messagesPayload.messages)) {
            setMessages(sortMessages(messagesPayload.messages))
          }
        } catch (error) {
          console.error('[live-chat] Unexpected error loading existing room', error)
        }

        return
      }

      const targetClientId = clientId ?? currentUser?.clientId
      if (!targetClientId || targetClientId.trim().length === 0) {
        console.warn('[live-chat] Missing client context. Skipping room bootstrap.')
        return
      }

      try {
        const trimmedClientId = targetClientId.trim()

        const roomResponse = await fetch('/api/live-chat/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            roomName,
            clientId: trimmedClientId,
            userId: currentUser?.id,
          }),
        })

        if (!roomResponse.ok) {
          console.error('[live-chat] Failed to create or fetch room', await roomResponse.text())
          return
        }

        const roomPayload = (await roomResponse.json()) as RoomPayload

        const resolvedRoom = roomPayload.room
        if (!resolvedRoom?.id) {
          console.error('[live-chat] Room payload missing required fields')
          return
        }

        if (!isMounted) return
        setRoom({ id: resolvedRoom.id, name: resolvedRoom.name ?? null })

        const messagesResponse = await fetch(`/api/live-chat/rooms/${resolvedRoom.id}/messages`)

        if (!messagesResponse.ok) {
          console.error('[live-chat] Failed to load room messages', await messagesResponse.text())
          return
        }

        const messagesPayload = (await messagesResponse.json()) as MessagesPayload

        if (!isMounted) return
        if (Array.isArray(messagesPayload.messages)) {
          setMessages(sortMessages(messagesPayload.messages))
        }
      } catch (error) {
        console.error('[live-chat] Unexpected error initialising room', error)
      }
    }

    setMessages([])
    setRoom(null)

    if (!isInitializing) {
      bootstrapRoom()
    }

    return () => {
      isMounted = false
    }
  }, [roomName, roomId, clientId, currentUser?.clientId, currentUser?.id, isInitializing])

  useEffect(() => {
    if (!room?.id) {
      return
    }

    const channelName = `live-chat:${room.id}`
    const newChannel = supabase.channel(channelName)

    newChannel
      .on('broadcast', { event: EVENT_MESSAGE_TYPE }, (payload) => {
        appendMessage(payload.payload as ChatMessage)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true)
        } else {
          setIsConnected(false)
        }
      })

    setChannel(newChannel)

    return () => {
      setIsConnected(false)
      supabase.removeChannel(newChannel)
      setChannel(null)
    }
  }, [room?.id, supabase, appendMessage])

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim()
      if (!channel || !isConnected || !room?.id || !currentUser?.id || !trimmed) return

      try {
        const resolvedRole = senderRoleOverride ?? 'user'

        const response = await fetch(`/api/live-chat/rooms/${room.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: trimmed,
            senderId: currentUser.id,
            senderRole: resolvedRole,
            metadata: {
              name: currentUser.name,
              fallbackName: username,
            },
          }),
        })

        if (!response.ok) {
          console.error('[live-chat] Failed to create message', await response.text())
          return
        }

        const payload = (await response.json()) as { message?: ChatMessage }
        const message = payload.message

        if (!message) {
          console.error('[live-chat] Message payload missing')
          return
        }

        appendMessage(message)

        await channel.send({
          type: 'broadcast',
          event: EVENT_MESSAGE_TYPE,
          payload: message,
        })
      } catch (error) {
        console.error('[live-chat] Unexpected error sending message', error)
      }
    },
    [appendMessage, channel, currentUser?.id, currentUser?.name, isConnected, room?.id, senderRoleOverride, username]
  )

  return { messages, sendMessage, isConnected, currentUser, isInitializing }
}
