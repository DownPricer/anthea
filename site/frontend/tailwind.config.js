/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'var(--background)',
  			foreground: 'var(--foreground)',
  			surface: {
  				DEFAULT: 'var(--surface)',
  				elevated: 'var(--surface-elevated)',
  				subtle: 'var(--surface-subtle)',
  				high: 'var(--surface-high)',
  			},
  			muted: {
  				DEFAULT: 'var(--foreground-muted)',
  				foreground: 'var(--foreground-muted)',
  				subtle: 'var(--foreground-subtle)',
  			},
  			subtle: 'var(--foreground-subtle)',
  			border: {
  				DEFAULT: 'var(--border)',
  				strong: 'var(--border-strong)',
  			},
  			input: {
  				DEFAULT: 'var(--border)',
  				background: 'var(--input-background)',
  			},
  			overlay: 'var(--overlay)',
  			hover: 'var(--hover)',
  			active: 'var(--active)',
  			card: {
  				DEFAULT: 'var(--surface-elevated)',
  				foreground: 'var(--foreground)',
  			},
  			popover: {
  				DEFAULT: 'var(--surface-elevated)',
  				foreground: 'var(--foreground)',
  			},
  			primary: {
  				DEFAULT: 'var(--theme-primary)',
  				foreground: 'var(--theme-primary-foreground)',
  			},
  			secondary: {
  				DEFAULT: 'var(--surface-subtle)',
  				foreground: 'var(--foreground)',
  			},
  			accent: {
  				DEFAULT: 'var(--theme-surface-active)',
  				foreground: 'var(--theme-primary)',
  			},
  			destructive: {
  				DEFAULT: 'var(--destructive)',
  				foreground: 'var(--destructive-foreground)',
  			},
  			ring: 'var(--theme-primary)',
  			skeleton: 'var(--skeleton)',
  			unread: 'var(--unread)',
  			nav: 'var(--nav-bg)',
  			chart: {
  				grid: 'var(--chart-grid)',
  				axis: 'var(--chart-axis)',
  				tooltip: 'var(--chart-tooltip-bg)',
  				'tooltip-text': 'var(--chart-tooltip-text)',
  				'1': 'var(--theme-primary)',
  				'2': 'var(--theme-secondary)',
  				'3': 'var(--theme-accent)',
  				'4': 'var(--warning)',
  				'5': 'var(--success)',
  			}
  		},
  		boxShadow: {
  			theme: '0 1px 3px var(--shadow-color)',
  			'theme-md': '0 4px 16px var(--shadow-color)',
  		},
  		ringOffsetColor: {
  			background: 'var(--background)',
  			surface: 'var(--surface)',
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
