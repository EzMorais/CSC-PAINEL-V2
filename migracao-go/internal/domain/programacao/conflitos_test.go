package programacao

import "testing"

func strp(s string) *string { return &s }

func TestConferirQuadroPessoaEmDuasFrentes(t *testing.T) {
	frentes := []Frente{{ID: "f1", Nome: "MORELLI"}, {ID: "f2", Nome: "GALPÃO"}}
	escalas := []Escala{
		{ID: "e1", FrenteID: "f1", Nome: "João Silva"},
		{ID: "e2", FrenteID: "f2", Nome: "joão silva"}, // mesmo nome, caixa diferente
	}
	conflitos := ConferirQuadro(escalas, nil, frentes, nil)
	if len(conflitos) != 1 {
		t.Fatalf("esperava 1 conflito, veio %d: %+v", len(conflitos), conflitos)
	}
	if conflitos[0].Gravidade != GravidadeAlta {
		t.Errorf("esperava gravidade alta, veio %s", conflitos[0].Gravidade)
	}
}

func TestConferirQuadroVeiculoEmDuasFrentes(t *testing.T) {
	frentes := []Frente{{ID: "f1", Nome: "MORELLI"}, {ID: "f2", Nome: "GALPÃO"}}
	recursos := []Recurso{
		{ID: "r1", FrenteID: "f1", Tipo: RecursoVeiculo, Placa: strp("PXF-4H26"), Descricao: "Doblô", MotoristaNome: strp("Zé")},
		{ID: "r2", FrenteID: "f2", Tipo: RecursoVeiculo, Placa: strp("pxf4h26"), Descricao: "Doblô", MotoristaNome: strp("Zé")},
	}
	conflitos := ConferirQuadro(nil, recursos, frentes, nil)
	achouPlaca := false
	for _, c := range conflitos {
		if c.Gravidade == GravidadeAlta && len(c.FrenteIDs) == 2 {
			achouPlaca = true
		}
	}
	if !achouPlaca {
		t.Fatalf("esperava conflito de placa duplicada, veio %+v", conflitos)
	}
}

func TestConferirQuadroMotoristaNaoEscalado(t *testing.T) {
	frentes := []Frente{{ID: "f1", Nome: "MORELLI"}}
	recursos := []Recurso{{ID: "r1", FrenteID: "f1", Tipo: RecursoVeiculo, Descricao: "Doblô", MotoristaNome: strp("Zé")}}
	conflitos := ConferirQuadro(nil, recursos, frentes, nil)
	if len(conflitos) != 1 || conflitos[0].Gravidade != GravidadeMedia {
		t.Fatalf("esperava 1 conflito médio (motorista não escalado), veio %+v", conflitos)
	}
}

func TestConferirQuadroVeiculoSemMotorista(t *testing.T) {
	frentes := []Frente{{ID: "f1", Nome: "MORELLI"}}
	recursos := []Recurso{{ID: "r1", FrenteID: "f1", Tipo: RecursoVeiculo, Descricao: "Doblô"}}
	conflitos := ConferirQuadro(nil, recursos, frentes, nil)
	if len(conflitos) != 1 || conflitos[0].Gravidade != GravidadeMedia {
		t.Fatalf("esperava 1 conflito médio (sem motorista), veio %+v", conflitos)
	}
}

func TestConferirQuadroSemConflitos(t *testing.T) {
	frentes := []Frente{{ID: "f1", Nome: "MORELLI"}}
	escalas := []Escala{{ID: "e1", FrenteID: "f1", Nome: "João"}}
	recursos := []Recurso{{ID: "r1", FrenteID: "f1", Tipo: RecursoVeiculo, Descricao: "Doblô", MotoristaNome: strp("João")}}
	conflitos := ConferirQuadro(escalas, recursos, frentes, nil)
	if len(conflitos) != 0 {
		t.Fatalf("não esperava conflito, veio %+v", conflitos)
	}
}

func TestConferirQuadroOrdenaGravesPrimeiro(t *testing.T) {
	frentes := []Frente{{ID: "f1", Nome: "A"}, {ID: "f2", Nome: "B"}}
	escalas := []Escala{{ID: "e1", FrenteID: "f1", Nome: "Ana"}, {ID: "e2", FrenteID: "f2", Nome: "Ana"}}
	recursos := []Recurso{{ID: "r1", FrenteID: "f1", Tipo: RecursoVeiculo, Descricao: "Doblô"}}
	conflitos := ConferirQuadro(escalas, recursos, frentes, nil)
	if len(conflitos) < 2 {
		t.Fatalf("esperava ao menos 2 conflitos, veio %+v", conflitos)
	}
	if conflitos[0].Gravidade != GravidadeAlta {
		t.Errorf("esperava o primeiro conflito ser de gravidade alta, veio %s", conflitos[0].Gravidade)
	}
	if conflitos[len(conflitos)-1].Gravidade != GravidadeMedia {
		t.Errorf("esperava o último conflito ser de gravidade média, veio %s", conflitos[len(conflitos)-1].Gravidade)
	}
}

func TestConferirQuadroVeiculoEmManutencao(t *testing.T) {
	frentes := []Frente{{ID: "f1", Nome: "MORELLI"}}
	recursos := []Recurso{{ID: "r1", FrenteID: "f1", Tipo: RecursoVeiculo, Placa: strp("ABC-1234"), Descricao: "Doblô", MotoristaNome: strp("Zé")}}
	emManutencao := map[string]string{"ABC1234": "troca de óleo"}
	conflitos := ConferirQuadro(nil, recursos, frentes, emManutencao)
	achou := false
	for _, c := range conflitos {
		if c.Gravidade == GravidadeAlta {
			achou = true
		}
	}
	if !achou {
		t.Fatalf("esperava conflito de manutenção, veio %+v", conflitos)
	}
}
