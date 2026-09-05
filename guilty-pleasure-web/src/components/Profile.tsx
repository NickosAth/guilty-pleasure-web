import { useEffect, useState } from 'react';

import {
  auth,
  changePassword,
  deleteOwnerAppointments,
  deleteUser,
  getProfile,
  removeProfile,
  updateProfile,
  verifyBeforeUpdateEmail,
} from '../lib/api';

import Modal from './Modal';

export default function Profile({
  username,
  isAdmin,
  onClose,
  onDeleted,
}: {
  username: string;
  isAdmin: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [email, setEmail] = useState('');
  const [newUsername] = useState(username);

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      return;
    }

    getProfile(user.uid).then((p) => {
      setEmail(
        String(
          p?.email ||
            user.email ||
            ''
        )
      );
    });
  }, []);

  const save = async () => {
    const user = auth.currentUser;

    if (!user) {
      return;
    }

    setMsg('');
    setError('');

    if (!newUsername.trim()) {
      setError(
        'Το όνομα χρήστη δεν μπορεί να είναι κενό.'
      );
      return;
    }

    if (!email.includes('@')) {
      setError('Ελέγξτε το email σας.');
      return;
    }

    /*
     * Password validation
     */
    if (password) {
      if (!currentPassword) {
        setError(
          'Για αλλαγή κωδικού πρέπει να εισάγετε τον τρέχοντα κωδικό.'
        );
        return;
      }

      if (password.length < 6) {
        setError(
          'Ο νέος κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες.'
        );
        return;
      }

      if (password !== confirmPassword) {
        setError(
          'Οι δύο νέοι κωδικοί δεν ταιριάζουν.'
        );
        return;
      }

      if (password === currentPassword) {
        setError(
          'Ο νέος κωδικός πρέπει να είναι διαφορετικός από τον τρέχοντα.'
        );
        return;
      }
    }

    setBusy(true);

    try {
      /*
       * PASSWORD CHANGE
       *
       * changePassword() performs the
       * current-password verification /
       * reauthentication and then changes
       * the password directly.
       *
       * It DOES NOT send a password-reset email.
       */
      if (password) {
        await changePassword(password);
      }

      /*
       * EMAIL CHANGE
       *
       * Only email changes use
       * verifyBeforeUpdateEmail().
       */
      const oldEmail =
        user.email?.trim().toLowerCase() || '';

      const newEmail =
        email.trim().toLowerCase();

      if (
        !isAdmin &&
        newEmail !== oldEmail
      ) {
        await verifyBeforeUpdateEmail(
          user,
          newEmail
        );
      }

      /*
       * Update Firestore profile.
       *
       * If Firebase has not yet verified
       * the new email, keep the old email
       * in Firestore.
       */
      if (!isAdmin) {
        await updateProfile(
          user.uid,
          newUsername,
          newEmail === oldEmail
            ? newEmail
            : oldEmail,
          username
        );
      }

      setCurrentPassword('');
      setPassword('');
      setConfirmPassword('');

      setMsg(
        password
          ? 'Ο κωδικός ενημερώθηκε επιτυχώς.'
          : 'Το προφίλ ενημερώθηκε επιτυχώς.'
      );
    } catch (e: unknown) {
      const errorCode =
        typeof e === 'object' &&
        e !== null &&
        'code' in e
          ? String(
              (e as { code?: unknown }).code
            )
          : '';

      const errorMessage =
        e instanceof Error
          ? e.message
          : String(e);

      if (
        errorCode ===
        'auth/invalid-credential'
      ) {
        setError(
          'Ο τρέχων κωδικός είναι λανθασμένος.'
        );
      } else if (
        errorCode ===
        'auth/wrong-password'
      ) {
        setError(
          'Ο τρέχων κωδικός είναι λανθασμένος.'
        );
      } else if (
        errorCode ===
        'auth/requires-recent-login'
      ) {
        setError(
          'Η σύνδεσή σας έχει λήξει. Παρακαλώ συνδεθείτε ξανά και δοκιμάστε πάλι.'
        );
      } else if (
        errorCode ===
        'auth/weak-password'
      ) {
        setError(
          'Ο νέος κωδικός είναι πολύ αδύναμος.'
        );
      } else if (
        errorCode ===
        'auth/email-already-in-use'
      ) {
        setError(
          'Αυτό το email χρησιμοποιείται ήδη από άλλον λογαριασμό.'
        );
      } else {
        setError(
          `Αποτυχία ενημέρωσης: ${errorMessage}`
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (
      isAdmin ||
      !auth.currentUser
    ) {
      return;
    }

    const confirmed = confirm(
      'Η διαγραφή είναι οριστική. Θέλετε να διαγράψετε τον λογαριασμό σας;'
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      await deleteOwnerAppointments(
        auth.currentUser.uid
      );

      await removeProfile(
        auth.currentUser.uid,
        username
      );

      await deleteUser(
        auth.currentUser
      );

      onDeleted();
    } catch (e: unknown) {
      const message =
        e instanceof Error
          ? e.message
          : String(e);

      setError(
        `Αποτυχία διαγραφής: ${message}`
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Το προφίλ μου"
      onClose={onClose}
    >
      <div className="modal-form">

        <label>
          Όνομα χρήστη

          <input
            value={newUsername}
            readOnly
          />
        </label>

        <label>
          Email

          <input
            value={email}
            readOnly={isAdmin}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />
        </label>

        <div className="profile-divider">
          Αλλαγή κωδικού
        </div>

        <label>
          Τρέχων κωδικός

          <input
            type="password"
            value={currentPassword}
            onChange={(e) =>
              setCurrentPassword(
                e.target.value
              )
            }
            placeholder="Τρέχων κωδικός"
            autoComplete="current-password"
          />
        </label>

        <label>
          Νέος κωδικός

          <input
            type="password"
            value={password}
            onChange={(e) =>
              setPassword(
                e.target.value
              )
            }
            placeholder="Νέος κωδικός"
            autoComplete="new-password"
          />
        </label>

        <label>
          Επιβεβαίωση νέου κωδικού

          <input
            type="password"
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(
                e.target.value
              )
            }
            placeholder="Επαναλάβετε τον νέο κωδικό"
            autoComplete="new-password"
          />
        </label>

        {error && (
          <div className="notice error">
            {error}
          </div>
        )}

        {msg && (
          <div className="notice success">
            {msg}
          </div>
        )}

        <button
          className="success-outline"
          disabled={busy}
          onClick={save}
        >
          {busy
            ? 'Αποθήκευση…'
            : 'Αποθήκευση'}
        </button>

        {!isAdmin && (
          <button
            className="danger-outline"
            disabled={busy}
            onClick={remove}
          >
            Διαγραφή λογαριασμού
          </button>
        )}

      </div>
    </Modal>
  );
}