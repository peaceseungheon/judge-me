import { Prisma } from '../../generated/prisma/client'

/** 유니크 제약 위반(P2002) 여부. 부분 유니크 인덱스 등 동시성 경합을 409로 변환할 때 사용. */
export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}
