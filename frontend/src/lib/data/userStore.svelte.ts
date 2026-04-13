export const userStore = $state<{
  id: number | null;
  username: string;
  firstname: string;
  lastname: string;
}>({
  id: null,
  username: '',
  firstname: '',
  lastname: '',
});
