import { defineEventHandler, setResponseStatus } from 'h3'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  await clearUserSession(event)
  setResponseStatus(event, 204)
  return null
})
