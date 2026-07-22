import { useTheme } from "../../context/ThemeContext"
import { Toaster as Sonner, toast } from "sonner"

const Toaster = ({
  ...props
}) => {
  const { colorMode } = useTheme()

  return (
    <Sonner
      theme={colorMode === 'light' ? 'light' : 'dark'}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-surface-elevated group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-theme-md",
          description: "group-[.toast]:text-muted",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-surface-subtle group-[.toast]:text-muted",
        },
      }}
      {...props} />
  );
}

export { Toaster, toast }
