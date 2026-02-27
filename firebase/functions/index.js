const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const safeRole = (value) => (value === 'rutbah' ? 'rutbah' : 'belal');
const partnerRole = (role) => (safeRole(role) === 'belal' ? 'rutbah' : 'belal');
const roleLabel = (role) => (safeRole(role) === 'belal' ? 'Belal' : 'Rutbah');

exports.notifyPartnerAttack = onDocumentCreated(
  'bossBattle/globalQuest/events/{eventId}',
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const payload = snapshot.data() || {};
    if (payload.type !== 'attack') return;

    const actor = safeRole(payload.actor);
    const target = partnerRole(actor);
    const damage = Number.isFinite(payload.damage) ? payload.damage : 25;

    const db = getFirestore();
    const tokenCollection = db.collection('mefilUsers').doc(target).collection('tokens');
    const tokenSnapshot = await tokenCollection.where('enabled', '==', true).get();
    if (tokenSnapshot.empty) return;

    const tokens = [];
    const tokenDocs = [];
    tokenSnapshot.forEach((docSnapshot) => {
      const token = String(docSnapshot.get('token') || '').trim();
      if (!token) return;
      tokens.push(token);
      tokenDocs.push(docSnapshot.ref);
    });

    if (!tokens.length) return;

    const response = await getMessaging().sendEachForMulticast({
      tokens,
      notification: {
        title: 'Boss Battle',
        body: `${roleLabel(actor)} dealt ${damage} DMG! Your turn to strike.`,
      },
      data: {
        type: 'attack',
        actor,
        damage: String(damage),
      },
    });

    const batch = db.batch();
    response.responses.forEach((result, index) => {
      if (result.success) return;
      const code = result.error?.code || '';
      const isInvalidToken = (
        code.includes('registration-token-not-registered')
        || code.includes('invalid-registration-token')
        || code.includes('mismatched-credential')
      );
      if (!isInvalidToken) return;
      const tokenRef = tokenDocs[index];
      if (!tokenRef) return;
      batch.set(tokenRef, {
        enabled: false,
        lastError: code,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    await batch.commit();
  },
);
