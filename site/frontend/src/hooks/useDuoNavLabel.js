import { useMemo } from 'react';
import { Heart, Handshake, ChartNoAxesColumnIncreasing, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Libellé et icône dynamiques pour l'entrée /duo (Solo vs Duo couple vs Duo amis).
 */
export function useDuoNavLabel() {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user?.partner_id) {
      return { label: 'Solo', Icon: ChartNoAxesColumnIncreasing, path: '/duo' };
    }

    const relation = user.relation_type || 'partners';
    if (relation === 'couple') {
      return { label: 'Duo', Icon: Heart, path: '/duo' };
    }
    if (relation === 'friends' || relation === 'partners') {
      return { label: 'Duo', Icon: Handshake, path: '/duo' };
    }

    return { label: 'Duo', Icon: Users, path: '/duo' };
  }, [user?.partner_id, user?.relation_type]);
}
