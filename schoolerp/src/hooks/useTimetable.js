import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listSlots, createSlot, updateSlot, deleteSlot } from '../api/timetable';

export function useTimetable(filters) {
  const queryClient = useQueryClient();

  const slots = useQuery({
    queryKey: ['timetable', 'slots', filters],
    queryFn: () => listSlots(filters),
    staleTime: 1000 * 60 * 2,
  });

  const create = useMutation({
    mutationFn: createSlot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
    },
  });

  const update = useMutation({
    mutationFn: ({ id, data }) => updateSlot(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
    },
  });

  const remove = useMutation({
    mutationFn: deleteSlot,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['timetable', 'slots', filters] });
      const prev = queryClient.getQueryData(['timetable', 'slots', filters]);
      queryClient.setQueryData(['timetable', 'slots', filters], (old) =>
        old ? old.filter(s => s.id !== id) : old
      );
      return { prev };
    },
    onError: (_, __, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(['timetable', 'slots', filters], ctx.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
    },
  });

  return { slots, create, update, remove, saving: create.isPending || update.isPending };
}
