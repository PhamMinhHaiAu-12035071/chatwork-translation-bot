const noop = () => undefined

export const useRouter = () => {
  return {
    push: noop,
    replace: noop,
    prefetch: noop,
    back: noop,
    forward: noop,
    refresh: noop,
  }
}

export const usePathname = () => ''

export const useSearchParams = () => new URLSearchParams()

export const useParams = () => ({})
