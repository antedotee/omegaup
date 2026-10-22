import 'bootstrap/dist/css/bootstrap.css';

export function hide(): void {
  $('#sample-modal').modal('hide');
  $('#sample-modal').closeModal();
}
