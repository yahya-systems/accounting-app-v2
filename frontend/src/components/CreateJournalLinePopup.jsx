import { useEffect, useRef, useState } from 'react'
import { createJournalLine, getAccount, getJournals } from '../api/client'
import { dayMonthToDateInputValue, dateInputValueToDayMonth } from '../utils/format'
import Popup from './Popup'
import AccountPickerPopup from './AccountPickerPopup'
import './CreateJournalLinePopup.css'

const currentYear = new Date().getFullYear()

function makeEmptyForm(journalId) {
  return {
    journal_id: journalId ? String(journalId) : '',
    account_id: '',
    counter_account_id: '',
    date: '',
    piece: '',
    libele: '',
    nature_achat: '',
    code_tva: '',
    type: 'debit', // 'debit' | 'credit' — applies to `account_id`; counter account gets the opposite
    amount: '',
  }
}

const ACHAT_VENTE_TYPES = ['Achats', 'Ventes']
const BANQUE_CAISSE_TYPES = ['Banque', 'Caisse']

function isAchatVente(journalType) {
  return ACHAT_VENTE_TYPES.includes(journalType)
}

// Achats/Ventes Libellé auto-fill rule: a complete 10-digit account id
// (Partie or Contre-partie, checked independently) prefixed by 3 or 4.
function isAchatVenteAutofillCode(accountId) {
  return /^[34]\d{9}$/.test(accountId.trim())
}

function isBanqueCaisse(journalType) {
  return BANQUE_CAISSE_TYPES.includes(journalType)
}

// Concatenates the description fields into the single `description` string
// the API expects. For Achats/Ventes journals: "[PIECE] — [LIBELE] — [NATURE
// D'ACHAT] — [CODE TVA]"; for other journal types, only Libellé is shown so
// the description is just "[LIBELE]". Empty segments are dropped rather than
// leaving a bare dash, so partially-filled forms don't produce " — Foo —  — ".
function buildDescription(form, journalType) {
  const parts = isAchatVente(journalType)
    ? [form.piece, form.libele, form.nature_achat, form.code_tva]
    : [form.libele]
  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' — ')
}

function fieldFromPath(path) {
  return Array.isArray(path) && path.length > 0 ? path[0] : null
}

function clientValidate(form, accountLookupStatus, counterAccountLookupStatus, requireJournalSelect) {
  const errors = {}

  if (requireJournalSelect && !form.journal_id) {
    errors.journal_id = 'journal est requis'
  }

  if (!form.account_id.trim()) {
    errors.account_id = 'account_id est requis'
  } else if (!/^\d+$/.test(form.account_id.trim())) {
    errors.account_id = 'account_id doit contenir uniquement des chiffres'
  } else if (accountLookupStatus === 'not-found') {
    errors.account_id = "Ce compte n'existe pas"
  }

  const counterAccountId = form.counter_account_id.trim()
  if (counterAccountId) {
    if (!/^\d+$/.test(counterAccountId)) {
      errors.counter_account_id = 'account_id doit contenir uniquement des chiffres'
    } else if (counterAccountLookupStatus === 'not-found') {
      errors.counter_account_id = "Ce compte n'existe pas"
    } else if (counterAccountId === form.account_id.trim()) {
      errors.counter_account_id = 'La contre-partie doit être différente de la partie'
    }
  }

  if (!form.date) {
    errors.date = 'date est requise'
  } else if (!/^\d{2}-\d{2}$/.test(form.date)) {
    errors.date = 'date must be in MM-DD format'
  }
  if (!form.libele.trim()) errors.libele = 'libellé est requis'

  const amountNum = Number(form.amount)
  if (!form.amount.trim() || Number.isNaN(amountNum) || amountNum <= 0) {
    errors.amount = 'Le montant doit être un nombre positif'
  }

  return errors
}

// Maps server-side field names back onto our form fields so validation
// errors surface next to the right input. `description` doesn't exist as a
// form field anymore (it's built from piece/libele/nature_achat/code_tva),
// so server-side description errors surface next to Libellé, the closest
// analog and the only required one of the four.
function mapServerField(field) {
  if (field === 'debit_amount' || field === 'credit_amount') return 'amount'
  if (field === 'description') return 'libele'
  return field
}

// Hook: live exact-id lookup against /api/accounts/:id, debounced. Returns
// [status, name] where status is 'idle' | 'loading' | 'found' | 'not-found'.
function useAccountLookup(accountId) {
  const [status, setStatus] = useState('idle')
  const [name, setName] = useState(null)
  const seqRef = useRef(0)

  useEffect(() => {
    const trimmed = accountId.trim()

    if (!trimmed || trimmed.length !== 10 || !/^\d+$/.test(trimmed)) {
      setStatus('idle')
      setName(null)
      return
    }

    const seq = ++seqRef.current
    setStatus('loading')

    const timeout = setTimeout(() => {
      getAccount(trimmed)
        .then((data) => {
          if (seqRef.current !== seq) return
          setName(data?.name ?? null)
          setStatus('found')
        })
        .catch(() => {
          if (seqRef.current !== seq) return
          setName(null)
          setStatus('not-found')
        })
    }, 250)

    return () => clearTimeout(timeout)
  }, [accountId])

  return [status, name, setStatus, setName, seqRef]
}

// Journal-line creation popup. When `journalId` is provided (e.g. from the
// journal detail page), the journal is fixed and not shown as a field. When
// omitted (e.g. the global /journal-lines page), a journal dropdown is shown
// instead so the user picks which journal the line belongs to.
//
// Supports two modes:
// - Single entry (default): only "Partie" is filled in, one journal line is created.
// - Double entry: "Contre-partie" is also filled in. Two journal lines are created in
//   one request — one for each account, same date/description, one debit and one credit
//   (the amount is shared; Type picks which side "Partie" gets, "Contre-partie" gets the
//   opposite). The debit line is always sent first in the array.
export default function CreateJournalLinePopup({ journalId, journalType, onClose, onCreated }) {
  const requireJournalSelect = !journalId

  const [form, setForm] = useState(() => makeEmptyForm(journalId))
  // When the journal is fixed via props, its type comes straight from
  // `journalType`. When the user picks a journal from the dropdown instead,
  // we derive the type from whichever journal in the fetched list matches
  // the currently selected journal_id.
  const [journals, setJournals] = useState([])
  const selectedJournalType = requireJournalSelect
    ? journals.find((j) => String(j.id) === form.journal_id)?.type
    : journalType
  const achatVente = isAchatVente(selectedJournalType)
  const banqueCaisse = isBanqueCaisse(selectedJournalType)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [accountLookupStatus, accountName, setAccountLookupStatus, setAccountName, accountLookupSeq] =
    useAccountLookup(form.account_id)
  const [
    counterAccountLookupStatus,
    counterAccountName,
    setCounterAccountLookupStatus,
    setCounterAccountName,
    counterAccountLookupSeq,
  ] = useAccountLookup(form.counter_account_id)

  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isCounterPickerOpen, setIsCounterPickerOpen] = useState(false)

  const isDoubleEntry = form.counter_account_id.trim().length > 0

  // Achats/Ventes: Libellé auto-fills from whichever of Partie/Contre-partie
  // resolves to a complete 10-digit id prefixed by 3 or 4, checked
  // independently per field. Only fires if the *other* account field is
  // also filled, and never overwrites a non-empty Libellé. This is the
  // entire Achats/Ventes autofill rule — no fallback to Partie's name
  // otherwise (unlike every other journal type, which doesn't autofill
  // Libellé at all in this component, or Banque/Caisse, handled separately
  // below).
  useEffect(() => {
    if (!achatVente) return
    if (!isAchatVenteAutofillCode(form.account_id)) return
    if (!form.counter_account_id.trim()) return
    if (accountLookupStatus !== 'found' || !accountName) return
    setForm((f) => (f.libele.trim() ? f : { ...f, libele: accountName }))
  }, [achatVente, form.account_id, form.counter_account_id, accountLookupStatus, accountName])

  useEffect(() => {
    if (!achatVente) return
    if (!isAchatVenteAutofillCode(form.counter_account_id)) return
    if (!form.account_id.trim()) return
    if (counterAccountLookupStatus !== 'found' || !counterAccountName) return
    setForm((f) => (f.libele.trim() ? f : { ...f, libele: counterAccountName }))
  }, [achatVente, form.account_id, form.counter_account_id, counterAccountLookupStatus, counterAccountName])

  // Non-Achats/Ventes, non-Banque/Caisse journals: Libellé auto-fills from
  // Partie's account name once it resolves via live lookup — only if
  // Libellé is still empty. (Achats/Ventes has its own rule above;
  // Banque/Caisse has its own rule below.)
  useEffect(() => {
    if (banqueCaisse || achatVente) return
    if (accountLookupStatus !== 'found' || !accountName) return
    setForm((f) => (f.libele.trim() ? f : { ...f, libele: accountName }))
  }, [banqueCaisse, achatVente, accountLookupStatus, accountName])

  // Banque/Caisse journals: auto-fill Libellé from the Contre-partie account
  // name instead of Partie's, once it resolves via live lookup — only if
  // Libellé is still empty.
  useEffect(() => {
    if (!banqueCaisse) return
    if (counterAccountLookupStatus !== 'found' || !counterAccountName) return
    setForm((f) => (f.libele.trim() ? f : { ...f, libele: counterAccountName }))
  }, [banqueCaisse, counterAccountLookupStatus, counterAccountName])

  useEffect(() => {
    if (!requireJournalSelect) return
    let cancelled = false

    getJournals()
      .then((data) => {
        if (cancelled) return
        setJournals(data)
      })
      .catch(() => {
        if (cancelled) return
        setJournals([])
      })

    return () => {
      cancelled = true
    }
  }, [requireJournalSelect])

  function updateField(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function handleAccountSelected(account) {
    // Skip the round-trip lookup: we already have the full account from the picker.
    accountLookupSeq.current += 1
    setForm((f) => {
      const shouldAutofill = achatVente
        ? isAchatVenteAutofillCode(account.id) && f.counter_account_id.trim()
        : !banqueCaisse
      return {
        ...f,
        account_id: account.id,
        // Banque/Caisse autofill Libellé from Contre-partie instead — see handleCounterAccountSelected.
        // Achats/Ventes follow the 3/4-prefix rule (see the effects above).
        libele: shouldAutofill && !f.libele.trim() ? account.name : f.libele,
      }
    })
    setAccountName(account.name)
    setAccountLookupStatus('found')
  }

  function handleCounterAccountSelected(account) {
    counterAccountLookupSeq.current += 1
    setForm((f) => {
      const shouldAutofill = achatVente
        ? isAchatVenteAutofillCode(account.id) && f.account_id.trim()
        : banqueCaisse
      return {
        ...f,
        counter_account_id: account.id,
        libele: shouldAutofill && !f.libele.trim() ? account.name : f.libele,
      }
    })
    setCounterAccountName(account.name)
    setCounterAccountLookupStatus('found')
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const errors = clientValidate(form, accountLookupStatus, counterAccountLookupStatus, requireJournalSelect)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setFormError(null)
      return
    }

    setFieldErrors({})
    setFormError(null)
    setSubmitting(true)

    try {
      const journal_id = Number(requireJournalSelect ? form.journal_id : journalId)
      const date = form.date
      const description = buildDescription(form, selectedJournalType)
      const amount = Number(form.amount)

      const partieLine = {
        journal_id,
        account_id: form.account_id.trim(),
        date,
        description,
        debit_amount: form.type === 'debit' ? amount : null,
        credit_amount: form.type === 'credit' ? amount : null,
      }

      const lines = [partieLine]

      if (isDoubleEntry) {
        const contrePartieLine = {
          journal_id,
          account_id: form.counter_account_id.trim(),
          date,
          description,
          debit_amount: form.type === 'credit' ? amount : null,
          credit_amount: form.type === 'debit' ? amount : null,
        }
        lines.push(contrePartieLine)
      }

      // Debit line always first.
      lines.sort((a, b) => (b.debit_amount ?? 0) - (a.debit_amount ?? 0))

      await createJournalLine(lines)
      onCreated?.()
      onClose?.()
    } catch (err) {
      if (Array.isArray(err.details)) {
        const nextFieldErrors = {}
        const generalMessages = []
        for (const issue of err.details) {
          const field = mapServerField(fieldFromPath(issue.path))
          if (field && field in form) {
            nextFieldErrors[field] = issue.message
          } else {
            generalMessages.push(issue.message)
          }
        }
        setFieldErrors(nextFieldErrors)
        setFormError(generalMessages.join(' ') || null)
      } else {
        setFormError(err.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="create-journal-line-form" onSubmit={handleSubmit}>
      {requireJournalSelect && (
        <div className="form-field">
          <label htmlFor="cjl-journal-id">Journal</label>
          <select
            id="cjl-journal-id"
            value={form.journal_id}
            onChange={(e) => updateField('journal_id', e.target.value)}
          >
            <option value="">Sélectionner…</option>
            {journals.map((journal) => (
              <option key={journal.id} value={journal.id}>
                {journal.name}
              </option>
            ))}
          </select>
          {fieldErrors.journal_id && <p className="field-error">{fieldErrors.journal_id}</p>}
        </div>
      )}

      <div className="form-field">
        <label htmlFor="cjl-account-id">Compte</label>
        <div className="form-field-with-hint">
          <input
            id="cjl-account-id"
            type="text"
            value={form.account_id}
            onChange={(e) => updateField('account_id', e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              setIsPickerOpen(true)
            }}
            placeholder="4481000000"
            maxLength={10}
          />
          <button type="button" className="button" onClick={() => setIsPickerOpen(true)}>
            Choisir…
          </button>
          {accountLookupStatus === 'found' && (
            <span className="form-field-hint">{accountName}</span>
          )}
          {accountLookupStatus === 'not-found' && (
            <span className="form-field-hint form-field-hint-error">Ce compte n'existe pas</span>
          )}
        </div>
        {fieldErrors.account_id && <p className="field-error">{fieldErrors.account_id}</p>}
      </div>

      <Popup open={isPickerOpen} onClose={() => setIsPickerOpen(false)} title="Choisir un compte">
        <AccountPickerPopup
          key={isPickerOpen ? form.account_id : 'closed'}
          onSelect={handleAccountSelected}
          onClose={() => setIsPickerOpen(false)}
          initialCode={form.account_id.trim()}
        />
      </Popup>

      <div className="form-field">
        <label htmlFor="cjl-counter-account-id">Contre-partie (optionnel)</label>
        <div className="form-field-with-hint">
          <input
            id="cjl-counter-account-id"
            type="text"
            value={form.counter_account_id}
            onChange={(e) => updateField('counter_account_id', e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              e.preventDefault()
              setIsCounterPickerOpen(true)
            }}
            placeholder="4481000000"
            maxLength={10}
          />
          <button type="button" className="button" onClick={() => setIsCounterPickerOpen(true)}>
            Choisir…
          </button>
          {counterAccountLookupStatus === 'found' && (
            <span className="form-field-hint">{counterAccountName}</span>
          )}
          {counterAccountLookupStatus === 'not-found' && (
            <span className="form-field-hint form-field-hint-error">Ce compte n'existe pas</span>
          )}
        </div>
        {fieldErrors.counter_account_id && (
          <p className="field-error">{fieldErrors.counter_account_id}</p>
        )}
      </div>

      <Popup
        open={isCounterPickerOpen}
        onClose={() => setIsCounterPickerOpen(false)}
        title="Choisir un compte"
      >
        <AccountPickerPopup
          key={isCounterPickerOpen ? form.counter_account_id : 'closed'}
          onSelect={handleCounterAccountSelected}
          onClose={() => setIsCounterPickerOpen(false)}
          initialCode={form.counter_account_id.trim()}
        />
      </Popup>

      <div className="form-field">
        <label htmlFor="cjl-date">Date (MM-JJ)</label>
        <input
          id="cjl-date"
          type="date"
          min={`${currentYear}-01-01`}
          max={`${currentYear}-12-31`}
          value={dayMonthToDateInputValue(form.date)}
          onChange={(e) => updateField('date', dateInputValueToDayMonth(e.target.value))}
        />
        {fieldErrors.date && <p className="field-error">{fieldErrors.date}</p>}
      </div>

      {achatVente ? (
        <>
          <div className="form-field-row">
            <div className="form-field">
              <label htmlFor="cjl-piece">Pièce</label>
              <input
                id="cjl-piece"
                type="text"
                value={form.piece}
                onChange={(e) => updateField('piece', e.target.value)}
              />
              {fieldErrors.piece && <p className="field-error">{fieldErrors.piece}</p>}
            </div>
            <div className="form-field">
              <label htmlFor="cjl-libele">Libellé</label>
              <input
                id="cjl-libele"
                type="text"
                value={form.libele}
                onChange={(e) => updateField('libele', e.target.value)}
              />
              {fieldErrors.libele && <p className="field-error">{fieldErrors.libele}</p>}
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="cjl-nature-achat">Nature d'achat</label>
            <input
              id="cjl-nature-achat"
              type="text"
              value={form.nature_achat}
              onChange={(e) => updateField('nature_achat', e.target.value)}
            />
            {fieldErrors.nature_achat && <p className="field-error">{fieldErrors.nature_achat}</p>}
          </div>

          <div className="form-field">
            <label htmlFor="cjl-code-tva">Code TVA</label>
            <input
              id="cjl-code-tva"
              type="text"
              value={form.code_tva}
              onChange={(e) => updateField('code_tva', e.target.value)}
            />
            {fieldErrors.code_tva && <p className="field-error">{fieldErrors.code_tva}</p>}
          </div>
        </>
      ) : (
        <div className="form-field">
          <label htmlFor="cjl-libele">Libellé</label>
          <input
            id="cjl-libele"
            type="text"
            value={form.libele}
            onChange={(e) => updateField('libele', e.target.value)}
          />
          {fieldErrors.libele && <p className="field-error">{fieldErrors.libele}</p>}
        </div>
      )}

      <div className="form-field">
        <label>Type{isDoubleEntry ? ' (Compte)' : ''}</label>
        <div className="type-toggle">
          <label className="type-toggle-option">
            <input
              type="radio"
              name="cjl-type"
              value="debit"
              checked={form.type === 'debit'}
              onChange={() => updateField('type', 'debit')}
            />
            Débit
          </label>
          <label className="type-toggle-option">
            <input
              type="radio"
              name="cjl-type"
              value="credit"
              checked={form.type === 'credit'}
              onChange={() => updateField('type', 'credit')}
            />
            Crédit
          </label>
        </div>
        {isDoubleEntry && (
          <p className="form-field-hint">
            La contre-partie recevra {form.type === 'debit' ? 'le crédit' : 'le débit'}.
          </p>
        )}
      </div>

      <div className="form-field">
        <label htmlFor="cjl-amount">Montant</label>
        <input
          id="cjl-amount"
          type="number"
          step="0.01"
          min="0"
          value={form.amount}
          onChange={(e) => updateField('amount', e.target.value)}
        />
        {fieldErrors.amount && <p className="field-error">{fieldErrors.amount}</p>}
      </div>

      {formError && <p className="error form-error">{formError}</p>}

      <div className="form-actions">
        <button type="button" className="button" onClick={onClose} disabled={submitting}>
          Annuler
        </button>
        <button type="submit" className="button" disabled={submitting}>
          {submitting ? 'Création…' : 'Créer'}
        </button>
      </div>
    </form>
  )
}
