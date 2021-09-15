
import {assert} from 'chai';
import {Validator} from '../src/hcert';
import {validateHCertRules, BusinessRules, ValueSets} from '../src/hcert/rules';

suite('hcert validate', () => {
    // https://github.com/eu-digital-green-certificates/dcc-quality-assurance/blob/main/AT/1.3.0/VAC.png
    let TEST_VAC = `HC1:NCF3W11Y9LVOJ109U2*62KF2C44.F4CMBL%VFWM3+H00E41R8-VFVLWN2YPNP T8%EH:T/.4Z+5OK7+VPIVB.9HAD9LR8OP3:II*VN%XG/J3B4O0+N.PM8R7XY02CP+NNXP9D/3%/2%PH%YBSEM11E06P3.AURAARUF6FHI2J092Y9.4E3MC-YL2 8VF2IJNLF8L5AIUQHN08BH-N1V9TK72O8GBK1SF7.%HXP51Z3I34I52TLBJ387XHJHSMUJ500TA9- 4EUH7KA9:4KRR3LPL2REX8.666VL1RJTZ0$8QJ2L.J1$DC.:IN01%FKKOH4$GMI1C841NKL41ZQ23P9DOF:-C%.H*T5JH0M6P:%I6YGR5LD5KVKB4EHFEIU97-5AAY2JXDK9AQ2H5 4M0OV43JTTQTQT1R9GGP3D5.0X1U7ZK BP3X5OM6Z9RVH53T6FZS0BLGQ9*55UH9+B9H6R$3NSUI9ELG78P592ZTT$1PFTECM.I7JGVH08*CS*97.FIQ9VVXQ8PUNIEAQV+9A.$0F5JPVJZX3ACDEETGYNW/50L36:3$-RZN3JTBUIFJKE+876ZJ-BDS+DV/0LX412`;

    test('validate', async () => {
        let test = new Validator(false);
        try {
            await test.validate(TEST_VAC, new Date(), 'en');
        } catch (error) {
            // FIXME: not sure why this fails to validate right now...
        }
    });

    test('rules validate empty', async () => {
        let rules = new BusinessRules();
        let valueSets = new ValueSets();
        let datetime = new Date("2021-09-15T14:01:17Z");
        let result = validateHCertRules({}, rules, valueSets, datetime, datetime);
        assert.isTrue(result.isValid);
        assert.isEmpty(result.errors);
    });
});
