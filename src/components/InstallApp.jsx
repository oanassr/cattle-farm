import { useEffect, useState } from 'react'
import { Modal } from './ui'

// هل يعمل النظام مثبّتاً على الجهاز (وضع standalone)؟
function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

// كشف أجهزة iOS (لا تدعم beforeinstallprompt فتُعرض لها إرشادات يدوية)
function isIOS() {
  const ua = window.navigator.userAgent || ''
  const iPhoneiPod = /iphone|ipad|ipod/i.test(ua)
  // آيباد الحديث يظهر كـ Mac مع دعم اللمس
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return iPhoneiPod || iPadOS
}

/**
 * زر «تحميل التطبيق» — يثبّت الـPWA على الجوال مباشرة.
 * - أندرويد/Chrome: يشغّل عرض التثبيت الأصلي عبر beforeinstallprompt.
 * - آيفون/آيباد: يعرض إرشادات «إضافة إلى الشاشة الرئيسية».
 * - يختفي تلقائياً إذا كان التطبيق مثبّتاً مسبقاً أو غير قابل للتثبيت.
 */
export default function InstallApp({ variant = 'ghost', block = false }) {
  // قد يُطلق الحدث قبل تحميل المكوّن؛ نلتقطه مبكراً من index.html
  const [deferred, setDeferred] = useState(() => window.__deferredInstallPrompt || null)
  const [installed, setInstalled] = useState(isStandalone())
  const [showIOS, setShowIOS] = useState(false)

  useEffect(() => {
    const onAvailable = () => setDeferred(window.__deferredInstallPrompt || null)
    const onPrompt = (e) => {
      e.preventDefault()
      window.__deferredInstallPrompt = e
      setDeferred(e)
    }
    const onInstalled = () => {
      window.__deferredInstallPrompt = null
      setDeferred(null)
      setInstalled(true)
    }

    window.addEventListener('pwa-install-available', onAvailable)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('pwa-install-available', onAvailable)
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // مثبّت بالفعل → لا داعي للزر
  if (installed) return null

  const ios = isIOS()
  // على غير iOS نعرض الزر فقط حين يتوفّر عرض التثبيت من المتصفح
  // (تجنّباً لزر لا يفعل شيئاً على المتصفحات غير الداعمة)
  if (!ios && !deferred) return null

  const handleClick = async () => {
    if (ios) {
      setShowIOS(true)
      return
    }
    if (!deferred) return
    deferred.prompt()
    try {
      const { outcome } = await deferred.userChoice
      if (outcome === 'accepted') setInstalled(true)
    } catch {
      // تجاهُل: قد يُلغي المستخدم العرض
    }
    // العرض يُستخدم مرة واحدة فقط
    window.__deferredInstallPrompt = null
    setDeferred(null)
  }

  const cls = [
    'btn',
    variant === 'primary' ? 'btn-primary' : 'btn-ghost',
    block ? 'btn-block' : 'btn-sm',
  ].join(' ')

  return (
    <>
      <button type="button" className={cls} onClick={handleClick} title="تثبيت التطبيق على الجوال">
        <span aria-hidden="true" style={{ marginInlineEnd: 6 }}>📥</span>
        تحميل التطبيق
      </button>

      {showIOS && (
        <Modal title="تثبيت التطبيق على آيفون / آيباد" onClose={() => setShowIOS(false)}>
          <p className="muted" style={{ marginBottom: 12 }}>
            على أجهزة آبل يُضاف التطبيق للشاشة الرئيسية من متصفّح <b>Safari</b>:
          </p>
          <ol style={{ lineHeight: 2, paddingInlineStart: 20, margin: 0 }}>
            <li>افتح النظام عبر متصفّح <b>Safari</b>.</li>
            <li>اضغط زر <b>المشاركة</b> (المربّع مع السهم لأعلى ⬆️) أسفل الشاشة.</li>
            <li>اختر <b>«إضافة إلى الشاشة الرئيسية»</b>.</li>
            <li>اضغط <b>«إضافة»</b> — وستظهر أيقونة التطبيق على جهازك 🐄.</li>
          </ol>
        </Modal>
      )}
    </>
  )
}
