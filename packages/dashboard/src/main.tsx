import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { NextStepProvider } from 'nextstepjs'
import { RouterProvider } from 'react-router'
import { ToastProvider } from '~/components/organisms/toast-provider'
import { router } from '~/router'
import '~/styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <ToastProvider>
      <NextStepProvider>
        <RouterProvider router={router} />
      </NextStepProvider>
    </ToastProvider>
  </StrictMode>,
)
