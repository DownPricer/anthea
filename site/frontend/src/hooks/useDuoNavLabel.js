import { useMemo } from 'react';
import { Heart, Handshake, ChartNoAxesColumnIncreasing, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';

/**
 * Libellé et icône dynamiques pour l'entrée /duo (Solo vs Duo couple vs Duo amis).
 */
export function useDuoNavLabel() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation('navigation');

  return useMemo(() => {
    if (!user?.partner_id) {
      return { label: t('items.solo'), Icon: ChartNoAxesColumnIncreasing, path: '/duo' };
    }

    const relation = user.relation_type || 'partners';
    if (relation === 'couple') {
      return { label: t('items.duo'), Icon: Heart, path: '/duo' };
    }
    if (relation === 'friends' || relation === 'partners') {
      return { label: t('items.duo'), Icon: Handshake, path: '/duo' };
    }

    return { label: t('items.duo'), Icon: Users, path: '/duo' };
  }, [user?.partner_id, user?.relation_type, i18n.language, t]);
}
