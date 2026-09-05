import { auth, db } from './firebase';

import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import type {
  Appointment,
  AppointmentStatus,
  BookedSlot,
  UserProfile,
} from '../types';

export const ADMIN_EMAIL = 'admin@guiltypleasure.gr';

/* ======================================================
   Error helpers
====================================================== */

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error
  ) {
    return String(
      (error as { message?: unknown }).message ?? ''
    );
  }

  return String(error);
}

/* ======================================================
   Username / Profile
====================================================== */

export async function resolveUsername(username: string) {
  const normalizedUsername =
    username.trim().toLowerCase();

  const snap = await getDoc(
    doc(db, 'usernames', normalizedUsername)
  );

  return snap.exists() ? snap.data() : null;
}

export async function getProfile(uid: string) {
  const snap = await getDoc(
    doc(db, 'users', uid)
  );

  return snap.exists()
    ? snap.data()
    : null;
}

export async function registerProfile(
  uid: string,
  username: string,
  email: string
) {
  const u = username.trim();
  const e = email.trim().toLowerCase();

  await setDoc(
    doc(db, 'usernames', u.toLowerCase()),
    {
      uid,
      email: e,
    }
  );

  await setDoc(
    doc(db, 'users', uid),
    {
      username: u,
      email: e,
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}

export async function updateProfile(
  uid: string,
  newUsername: string,
  newEmail: string,
  previousUsername?: string
) {
  const u = newUsername.trim();
  const e = newEmail.trim().toLowerCase();

  await setDoc(
    doc(db, 'users', uid),
    {
      username: u,
      email: e,
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    }
  );

  if (
    previousUsername &&
    previousUsername.trim().toLowerCase() !==
      u.toLowerCase()
  ) {
    await deleteDoc(
      doc(
        db,
        'usernames',
        previousUsername.trim().toLowerCase()
      )
    );
  }

  await setDoc(
    doc(db, 'usernames', u.toLowerCase()),
    {
      uid,
      email: e,
    }
  );
}

export async function removeProfile(
  uid: string,
  username: string
) {
  const batch = writeBatch(db);

  batch.delete(
    doc(db, 'users', uid)
  );

  batch.delete(
    doc(
      db,
      'usernames',
      username.trim().toLowerCase()
    )
  );

  await batch.commit();
}

/* ======================================================
   Authentication
====================================================== */

export async function login(
  identifier: string,
  password: string
) {
  let email = identifier.trim();

  /*
   * Login using username
   */
  if (!email.includes('@')) {
    const result =
      await resolveUsername(email);

    email = String(result?.email || '');

    /*
     * Admin can login using "admin"
     */
    if (
      !email &&
      identifier.toLowerCase() === 'admin'
    ) {
      email = ADMIN_EMAIL;
    }
  }

  if (!email) {
    throw new Error('user-not-found');
  }

  const credential =
    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

  await credential.user.reload();

  const isAdmin =
    credential.user.email?.toLowerCase() ===
    ADMIN_EMAIL;

  /*
   * Normal users must verify email.
   */
  if (
    !isAdmin &&
    !credential.user.emailVerified
  ) {
    const user = credential.user;

    await signOut(auth);

    const error =
      new Error('unverified') as Error & {
        user?: typeof user;
      };

    error.user = user;

    throw error;
  }

  let profile =
    await getProfile(
      credential.user.uid
    );

  /*
   * Create missing profile automatically.
   */
  if (!profile) {
    const username =
      identifier.includes('@')
        ? credential.user.email!.split('@')[0]
        : identifier;

    await registerProfile(
      credential.user.uid,
      username,
      credential.user.email || email
    );

    profile =
      await getProfile(
        credential.user.uid
      );
  }

  const profileUsername = String(
    profile?.username ||
      credential.user.email?.split('@')[0] ||
      identifier
  );

  if (!await resolveUsername(profileUsername)) {
    await registerProfile(
      credential.user.uid,
      profileUsername,
      credential.user.email || email
    );
  }

  return {
    user: credential.user,
    isAdmin,
    username: String(
      profile?.username || identifier
    ),
  };
}

export async function register(
  username: string,
  email: string,
  password: string
) {
  if (
    await resolveUsername(username)
  ) {
    throw new Error(
      'username-already-in-use'
    );
  }

  const credential =
    await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

  try {
    await registerProfile(
      credential.user.uid,
      username,
      email
    );

    await sendEmailVerification(
      credential.user
    );
  } catch (error: unknown) {
    try {
      await deleteUser(
        credential.user
      );
    } catch {
      // Cleanup failure ignored.
    }

    throw error;
  }

  await signOut(auth);
}

/* ======================================================
   Password
====================================================== */

/*
 * Direct password change.
 *
 * IMPORTANT:
 * This does NOT send a password reset email.
 *
 * Firebase may require a recent login. In that case
 * the caller should ask the user to login again.
 */
export async function changePassword(
  newPassword: string
) {
  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      'auth/no-current-user'
    );
  }

  if (newPassword.length < 6) {
    throw new Error(
      'auth/weak-password'
    );
  }

  await updatePassword(
    user,
    newPassword
  );
}

/*
 * Password reset email.
 *
 * This function is ONLY used by "Forgot password".
 */
export async function resetPassword(
  identifier: string
) {
  let email = identifier.trim();

  if (!email.includes('@')) {
    const result =
      await resolveUsername(email);

    email = String(
      result?.email || ''
    );

    if (
      !email &&
      identifier.toLowerCase() ===
        'admin'
    ) {
      email = ADMIN_EMAIL;
    }
  }

  if (!email) {
    throw new Error(
      'user-not-found'
    );
  }

  await sendPasswordResetEmail(
    auth,
    email
  );

  return email;
}

/* ======================================================
   Appointments
====================================================== */

export async function loadAppointments(
  ownerUid?: string | null
): Promise<Appointment[]> {
  const appointmentsCollection =
    collection(
      db,
      'appointments'
    );

  const appointmentsQuery =
    ownerUid
      ? query(
          appointmentsCollection,
          where(
            'ownerUid',
            '==',
            ownerUid
          )
        )
      : appointmentsCollection;

  const snap =
    await getDocs(
      appointmentsQuery
    );

  /*
   * Remove cancelled appointments
   * from Firestore, preserving the
   * original application behaviour.
   */
  const cancelled =
    snap.docs.filter(
      (document) =>
        document.data().status ===
        'cancelled'
    );

  if (cancelled.length) {
    const batch =
      writeBatch(db);

    cancelled.forEach(
      (document) => {
        batch.delete(
          document.ref
        );
      }
    );

    await batch.commit();
  }

  return snap.docs
    .filter(
      (document) =>
        document.data().status !==
        'cancelled'
    )
    .map(
      (document) =>
        fromAppointment(
          document.data()
        )
    )
    .sort(
      (a, b) =>
        a.dateTime.getTime() -
        b.dateTime.getTime()
    );
}

/* ======================================================
   Appointment converter
====================================================== */

function getAppointmentStatus(
  value: unknown
): AppointmentStatus {
  return value === 'cancelled'
    ? 'cancelled'
    : 'upcoming';
}

function fromAppointment(
  data: Record<string, unknown>
): Appointment {
  return {
    id: String(
      data.id ?? ''
    ),

    clientName: String(
      data.clientName ?? ''
    ),

    ownerUid:
      data.ownerUid === null ||
      data.ownerUid === undefined
        ? null
        : String(
            data.ownerUid
          ),

    service: String(
      data.service ?? ''
    ),

    dateTime:
      data.dateTime instanceof Date
        ? data.dateTime
        : new Date(
            String(
              data.dateTime ?? ''
            )
          ),

    price: Number(
      data.price ?? 0
    ),

    durationMinutes: Number(
      data.durationMinutes ?? 0
    ),

    status:
      getAppointmentStatus(
        data.status
      ),
  };
}

/* ======================================================
   Appointment slots
====================================================== */

export async function loadSlots(): Promise<
  BookedSlot[]
> {
  try {
    const snap =
      await getDocs(
        collection(
          db,
          'appointmentSlots'
        )
      );

    return snap.docs.map(
      (document) => {
        const data =
          document.data();

        return {
          id: document.id,

          startAt:
            data.startAt.toDate(),

          endAt:
            data.endAt.toDate(),
        };
      }
    );
  } catch (error: unknown) {
    console.error(
      'Failed to load appointment slots:',
      getErrorMessage(error)
    );

    return [];
  }
}

/* ======================================================
   Check slot availability
====================================================== */

export async function slotAvailable(
  start: Date,
  duration: number,
  excludeId?: string
) {
  const slots =
    await loadSlots();

  const end =
    new Date(
      start.getTime() +
        duration * 60 * 1000
    );

  return !slots.some(
    (slot) =>
      slot.id !== excludeId &&
      start < slot.endAt &&
      end > slot.startAt
  );
}

/* ======================================================
   Save appointments
====================================================== */

export async function saveAppointments(
  appointments: Appointment[]
) {
  if (
    !appointments.length
  ) {
    return;
  }

  const batch =
    writeBatch(db);

  appointments.forEach(
    (appointment) => {
      const appointmentRef =
        doc(
          db,
          'appointments',
          appointment.id
        );

      const slotRef =
        doc(
          db,
          'appointmentSlots',
          appointment.id
        );

      batch.set(
        appointmentRef,
        {
          id: appointment.id,

          clientName:
            appointment.clientName,

          ownerUid:
            appointment.ownerUid ??
            null,

          service:
            appointment.service,

          dateTime:
            appointment.dateTime.toISOString(),

          price:
            appointment.price,

          durationMinutes:
            appointment.durationMinutes,

          status:
            appointment.status,
        }
      );

      batch.set(
        slotRef,
        {
          startAt:
            appointment.dateTime,

          endAt:
            new Date(
              appointment.dateTime.getTime() +
                appointment.durationMinutes *
                  60 *
                  1000
            ),
        }
      );
    }
  );

  await batch.commit();
}

/* ======================================================
   Delete appointment
====================================================== */

export async function deleteAppointment(
  id: string
) {
  const batch =
    writeBatch(db);

  batch.delete(
    doc(
      db,
      'appointments',
      id
    )
  );

  batch.delete(
    doc(
      db,
      'appointmentSlots',
      id
    )
  );

  await batch.commit();
}

/* ======================================================
   Delete user's appointments
====================================================== */

export async function deleteOwnerAppointments(
  uid: string
) {
  const snap =
    await getDocs(
      query(
        collection(
          db,
          'appointments'
        ),
        where(
          'ownerUid',
          '==',
          uid
        )
      )
    );

  const batch =
    writeBatch(db);

  snap.docs.forEach(
    (document) => {
      batch.delete(
        document.ref
      );

      batch.delete(
        doc(
          db,
          'appointmentSlots',
          document.id
        )
      );
    }
  );

  await batch.commit();
}

/* ======================================================
   Users
====================================================== */

export async function getUsers(): Promise<
  UserProfile[]
> {
  const snap =
    await getDocs(
      collection(
        db,
        'users'
      )
    );

  return snap.docs
    .map(
      (document) => ({
        uid: document.id,

        username: String(
          document.data()
            .username || ''
        ),

        email: String(
          document.data()
            .email || ''
        ),
      })
    )
    .filter(
      (user) =>
        user.username &&
        user.email
          .toLowerCase() !==
          ADMIN_EMAIL
    )
    .sort(
      (a, b) =>
        a.username.localeCompare(
          b.username
        )
    );
}

/* ======================================================
   Firebase exports
====================================================== */

export {
  signOut,
  updatePassword,
  verifyBeforeUpdateEmail,
  auth,
  deleteUser,
};