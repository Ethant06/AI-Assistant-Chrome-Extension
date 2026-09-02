
/**
 * Layout for login and register pages
 * Centers a card on a dark background - no sidebar or nav bar or any other dashboard since
 * the user is not authenticated yet and has nowhere to navigate to
 */
export default function AuthLayout({children,}: {children: React.ReactNode}) {


  return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm">{children}</div>
      </div>
  )
}